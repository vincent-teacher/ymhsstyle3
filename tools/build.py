# -*- coding: utf-8 -*-
"""楊梅高中梅岡風 網站建置工具

把 ../../梅岡風/ 資料夾內的「梅岡風NN期第N版.JPG」掃描檔轉成網頁用圖片，
以 Windows 內建 OCR 擷取文字，產生 data/issues.js 供網站讀取。

只會處理新增或變動過的圖片（增量更新），新增期別時直接重跑即可：
    python tools/build.py          一般更新
    python tools/build.py --noocr  只處理圖片，不做 OCR
    python tools/build.py --force  全部重做
"""
import json, os, re, subprocess, sys, tempfile, time
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(SITE), '梅岡風')
DATA = os.path.join(SITE, 'data')
WEB_W, THUMB_W, OCR_W = 2000, 420, 3000
NAME_RE = re.compile(r'^梅岡風\s*(\d+)\s*期\s*第\s*(\d+)\s*版(?:\.(jpe?g|png|webp|tiff?|bmp))?$', re.I)
CN_NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
          '十一': 11, '十二': 12, '元': 1}
# 常見版名（OCR 找到版頭時比對用；可自行增加）
SECTIONS = ['學校要聞', '藝智園', '生活與休閒', '擲地有聲', '多元學習', '校園動態', '藝文天地', '學生園地',
            '活動花絮', '榮譽榜', '專題報導', '輔導天地', '圖書館', '國際交流', '社團活動', '升學資訊',
            '校園生活', '藝文', '人物專訪', '特別企劃', '健康生活', '綜合報導']
PAGE_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']


def scan_sources():
    pages = []
    for fn in os.listdir(SRC):
        m = NAME_RE.match(fn.strip())
        if not m or not os.path.isfile(os.path.join(SRC, fn)):
            continue
        st = os.stat(os.path.join(SRC, fn))
        pages.append({'file': fn, 'issue': int(m.group(1)), 'page': int(m.group(2)),
                      'sig': f'{st.st_size}-{int(st.st_mtime)}'})
    pages.sort(key=lambda p: (p['issue'], p['page']))
    return pages


def key_of(p):
    return f"{p['issue']:02d}-{p['page']}"


def make_images(args):
    fn, key, need_ocr = args
    im = Image.open(os.path.join(SRC, fn))
    im.draft('RGB', (WEB_W * 2, WEB_W * 3))
    im = im.convert('RGB')
    w, h = im.size
    web = im.resize((WEB_W, round(h * WEB_W / w)), Image.LANCZOS)
    web.save(os.path.join(SITE, 'img', 'web', key + '.webp'), 'WEBP', quality=78, method=4)
    th = web.resize((THUMB_W, round(web.height * THUMB_W / WEB_W)), Image.LANCZOS)
    th.save(os.path.join(SITE, 'img', 'thumb', key + '.webp'), 'WEBP', quality=72, method=4)
    ocr_path = None
    if need_ocr:
        o = im.resize((OCR_W, round(h * OCR_W / w)), Image.LANCZOS) if w > OCR_W else im
        ocr_path = os.path.join(tempfile.gettempdir(), 'mgf_ocr_' + key + '.jpg')
        o.save(ocr_path, 'JPEG', quality=92)
    return key, [web.width, web.height], ocr_path


def run_ocr(jobs):
    lst = os.path.join(tempfile.gettempdir(), 'mgf_ocr_list.txt')
    with open(lst, 'w', encoding='utf-8') as f:
        for inp, out in jobs:
            f.write(f'{inp}|{out}\n')
    cmd = ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
           os.path.join(SITE, 'tools', 'ocr.ps1'), lst]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for line in proc.stdout:
        print('  ' + line.decode('utf-8', 'replace').rstrip(), flush=True)
    proc.wait()
    for inp, _ in jobs:
        try:
            os.remove(inp)
        except OSError:
            pass


def clean(t):
    return re.sub(r'\s+', '', t or '')


def analyse(ocr, page):
    """從 OCR 結果推測日期、版名、大標題。"""
    L = ocr.get('L', []) if ocr else []
    if L and isinstance(L[0], str):  # 單行時 PowerShell 會攤平
        L = [L]
    info = {'sec': '', 'date': '', 'heads': []}
    top = [l for l in L if l[2] < 60]
    toptext = ''.join(clean(l[0]) for l in sorted(top, key=lambda l: l[1]))
    m = re.search(r'((?:19|20)\d\d)\s*年\s*(十[一二]?|[一二三四五六七八九]|\d{1,2})\s*月', toptext)
    if m:
        mo = m.group(2)
        mo = int(mo) if mo.isdigit() else CN_NUM.get(mo, 0)
        if 1 <= mo <= 12:
            info['date'] = f'{m.group(1)}-{mo:02d}'
    for s in SECTIONS:
        if s in toptext:
            info['sec'] = s
            break
    if not info['sec']:
        m = re.search(r'第[一二三四五六七八九十]版[:：]?\s*([一-鿿]{2,6})', toptext) or \
            re.search(r'([一-鿿]{2,6})\s*第[一二三四五六七八九十]版', toptext)
        if m and not re.search(r'[年月號期]', m.group(1)):
            info['sec'] = re.sub(r'中華?民?國?$', '', m.group(1))
    hs = [l[4] - l[2] for l in L if len(clean(l[0])) >= 2]
    if hs:
        med = sorted(hs)[len(hs) // 2]
        heads = []
        for l in L:
            t = clean(l[0])
            if l[2] < 60 or len(t) < 3 or len(t) > 30:
                continue
            if (l[4] - l[2]) >= med * 2.0 and re.search(r'[一-鿿]{2}', t):
                heads.append((l[2], l[1], t))
        heads.sort()
        seen = []
        for _, _, t in heads:
            if t not in seen:
                seen.append(t)
        info['heads'] = seen[:8]
    return info, L


def main():
    force = '--force' in sys.argv
    noocr = '--noocr' in sys.argv
    t0 = time.time()
    cache_p = os.path.join(DATA, 'cache.json')
    cache = json.load(open(cache_p, encoding='utf-8')) if os.path.exists(cache_p) and not force else {}
    pages = scan_sources()
    print(f'找到 {len(pages)} 張版面圖片，{len({p["issue"] for p in pages})} 期')

    todo = []
    for p in pages:
        k = key_of(p)
        c = cache.get(k)
        img_ok = c and c.get('sig') == p['sig'] and os.path.exists(os.path.join(SITE, 'img', 'web', k + '.webp'))
        ocr_ok = os.path.exists(os.path.join(DATA, 'ocr', k + '.json')) and img_ok
        if not img_ok or (not noocr and not ocr_ok):
            todo.append((p['file'], k, not noocr))
    ocr_jobs = []
    if todo:
        print(f'處理圖片 {len(todo)} 張…')
        with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as ex:
            for i, (k, size, op) in enumerate(ex.map(make_images, todo), 1):
                sig = next(p['sig'] for p in pages if key_of(p) == k)
                cache[k] = {'sig': sig, 'size': size}
                if op:
                    ocr_jobs.append((op, os.path.join(DATA, 'ocr', k + '.json')))
                print(f'  圖片 {i}/{len(todo)} {k}', flush=True)
        json.dump(cache, open(cache_p, 'w', encoding='utf-8'), ensure_ascii=False)
    if ocr_jobs:
        print(f'OCR 文字辨識 {len(ocr_jobs)} 張…')
        run_ocr(ocr_jobs)

    meta_p = os.path.join(DATA, 'meta.json')
    meta = json.load(open(meta_p, encoding='utf-8')) if os.path.exists(meta_p) else {}
    issues = {}
    for p in pages:
        k = key_of(p)
        op = os.path.join(DATA, 'ocr', k + '.json')
        ocr = json.load(open(op, encoding='utf-8-sig')) if os.path.exists(op) else None
        info, L = analyse(ocr, p['page'])
        iss = issues.setdefault(p['issue'], {'no': p['issue'], 'dates': [], 'pages': []})
        if info['date']:
            iss['dates'].append(info['date'])
        iss['pages'].append({'p': p['page'], 'k': k, 'f': p['file'], 'wh': cache.get(k, {}).get('size', [2000, 2778]),
                             'sec': info['sec'], 'heads': info['heads'], 'L': L})

    # 版名：同一版序在相鄰期別常沿用，空白時參考前後期
    by_page = {}
    for no in sorted(issues):
        for pg in issues[no]['pages']:
            by_page.setdefault(pg['p'], []).append(pg)
    for plist in by_page.values():
        for i, pg in enumerate(plist):
            if not pg['sec']:
                for j in (i - 1, i + 1, i - 2, i + 2):
                    if 0 <= j < len(plist) and plist[j]['sec']:
                        pg['sec'] = plist[j]['sec']
                        break

    out = []
    for no in sorted(issues):
        iss = issues[no]
        date = Counter(iss.pop('dates')).most_common(1)[0][0] if iss['dates'] else ''
        m = meta.get(str(no), meta.get(f'{no:02d}', {}))
        iss['date'] = m.get('date', date)
        iss['title'] = m.get('title', '')
        iss['note'] = m.get('note', '')
        for pg in iss['pages']:
            if not pg['sec']:
                pg['sec'] = f'第{PAGE_CN[pg["p"]] if pg["p"] < len(PAGE_CN) else pg["p"]}版'
        out.append(iss)

    # 沒辨識到日期的期別：依前後期推估（約半年一期）
    known = [(i, o['date']) for i, o in enumerate(out) if o['date']]
    for i, o in enumerate(out):
        if not o['date'] and known:
            j, d = min(known, key=lambda kd: abs(kd[0] - i))
            y, mo = map(int, d.split('-'))
            tot = y * 12 + mo - 1 + (i - j) * 6
            o['date'] = f'{tot // 12}-{tot % 12 + 1:02d}'
            o['guess'] = True

    js = 'window.MGF_DATA = ' + json.dumps({'built': time.strftime('%Y-%m-%d %H:%M'), 'issues': out},
                                           ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(DATA, 'issues.js'), 'w', encoding='utf-8').write(js)

    idx = os.path.join(SITE, 'index.html')
    if os.path.exists(idx):
        h = open(idx, encoding='utf-8').read()
        h = re.sub(r'data/issues\.js\?v=\w+', 'data/issues.js?v=' + time.strftime('%Y%m%d%H%M%S'), h)
        open(idx, 'w', encoding='utf-8').write(h)
    print(f'完成：{len(out)} 期、{len(pages)} 版，耗時 {time.time() - t0:.0f} 秒')


if __name__ == '__main__':
    main()
