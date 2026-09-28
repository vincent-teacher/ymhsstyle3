/* 楊梅高中梅岡風 — 前端程式
 * 資料來源：data/issues.js（由 tools/build.py 依「梅岡風」資料夾自動產生）
 * 新增期別只要把圖片放進資料夾並執行「更新網站.bat」，本檔不需修改。 */
(() => {
'use strict';
const DATA = window.MGF_DATA || { issues: [] };
const ISSUES = DATA.issues.slice().sort((a, b) => a.no - b.no);
const SRC_DIR = '../梅岡風/';
const PAGE_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const main = $('#main');

/* ---------- 資料整理 ---------- */
const PAGES = [];
const byNo = {};
ISSUES.forEach(iss => {
  byNo[iss.no] = iss;
  iss.year = iss.date ? +iss.date.slice(0, 4) : 0;
  iss.month = iss.date ? +iss.date.slice(5, 7) : 0;
  iss.pages.sort((a, b) => a.p - b.p);
  iss.pages.forEach((pg, i) => {
    pg.iss = iss; pg.i = i;
    pg.L = (pg.L || []).filter(l => Array.isArray(l) && l.length >= 5);
    const hs = pg.L.map(l => l[4] - l[2]).sort((a, b) => a - b);
    pg.med = hs.length ? hs[hs.length >> 1] : 8;
    pg.heads = (pg.heads || []).filter(goodHead);
    pg.chars = pg.L.reduce((s, l) => s + l[0].replace(/\s/g, '').length, 0);
    PAGES.push(pg);
  });
});
const YEARS = [...new Set(ISSUES.map(i => i.year).filter(Boolean))].sort((a, b) => a - b);
const MAXP = Math.max(4, ...ISSUES.map(i => i.pages.length));
const SECS = (() => { const c = {}; PAGES.forEach(p => { if (p.sec && !/^第.+版$/.test(p.sec)) c[p.sec] = (c[p.sec] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); })();
const latest = ISSUES[ISSUES.length - 1];

function goodHead(t) {
  if (!t || t.length < 4 || t.length > 30) return false;
  const cjk = (t.match(/[一-鿿]/g) || []).length;
  if (cjk / t.length < .6) return false;
  if (/(.)\1\1/.test(t)) return false;
  return !/[Ⅰ-ⅿ乛乀彳亻吿å]/.test(t);
}
const issueLabel = iss => `第 ${iss.no} 期`;
const dateLabel = iss => iss.year ? `${iss.year} 年 ${iss.month} 月${iss.guess ? '（推估）' : ''}` : '日期未詳';
const pageLabel = pg => `第${PAGE_CN[pg.p] || pg.p}版`;
const thumb = pg => `img/thumb/${pg.k}.webp`;
const web = pg => `img/web/${pg.k}.webp`;
const pageUrl = (pg, q) => `#/read/${pg.iss.no}/${pg.p}${q ? '?q=' + encodeURIComponent(q) : ''}`;
const findPage = (no, p) => { const iss = byNo[no]; return iss && (iss.pages.find(x => x.p === p) || iss.pages[0]); };

/* ---------- 本機儲存（失敗時仍可正常使用） ---------- */
const DEF = { settings: { font: 'm', sound: true, vol: 60, music: false, petals: true, anim: true, dark: false, text: false },
  seen: {}, fav: [], hist: [], searches: 0, recentQ: [], game: { best: 0, correct: 0, played: 0, bestStreak: 0 }, badges: [], zoomMax: 0, hd: 0 };
let S;
try { S = Object.assign(structuredClone(DEF), JSON.parse(localStorage.getItem('mgf.v1') || '{}')); S.settings = Object.assign({}, DEF.settings, S.settings); S.game = Object.assign({}, DEF.game, S.game); }
catch (e) { S = structuredClone(DEF); }
if (!localStorage.getItem('mgf.v1') && matchMedia('(prefers-color-scheme: dark)').matches) S.settings.dark = true;
if (matchMedia('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem('mgf.v1')) S.settings.anim = false;
function save() { try { localStorage.setItem('mgf.v1', JSON.stringify(S)); } catch (e) { /* 私密模式 */ } }

/* ---------- 音效（Web Audio 即時合成，不需外部檔案） ---------- */
const Sound = (() => {
  let ctx, master, musicTimer, delay;
  function init() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
      delay = ctx.createDelay(); delay.delayTime.value = .32;
      const fb = ctx.createGain(); fb.gain.value = .32; delay.connect(fb); fb.connect(delay); delay.connect(master);
      setVol();
    } catch (e) { ctx = null; }
    return ctx;
  }
  function setVol() { if (master) master.gain.value = (S.settings.vol / 100) * .55; }
  function tone(f, t0, dur, type = 'sine', g = .3, slide, echo) {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(g, t0 + .012); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(master); if (echo) gn.connect(delay);
    o.start(t0); o.stop(t0 + dur + .05);
  }
  function noise(t0, dur, f0, f1, g = .25) {
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const gn = ctx.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(gn); gn.connect(master); src.start(t0);
  }
  const fx = {
    click: t => tone(880, t, .07, 'triangle', .18, 1320),
    tick: t => tone(1500, t, .03, 'sine', .06),
    flip: t => { noise(t, .28, 3500, 500, .35); tone(220, t + .02, .12, 'sine', .05); },
    open: t => { tone(392, t, .18, 'sine', .15, 784); noise(t, .2, 800, 3000, .08); },
    close: t => tone(660, t, .15, 'sine', .14, 330),
    ok: t => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * .075, .35, 'triangle', .2, null, true)),
    bad: t => { tone(196, t, .22, 'sawtooth', .12, 150); tone(185, t + .12, .3, 'sawtooth', .1, 130); },
    badge: t => [659.25, 783.99, 987.77, 1318.5, 1567.98].forEach((f, i) => tone(f, t + i * .09, .5, 'sine', .22, null, true)),
    search: t => { tone(700, t, .09, 'sine', .15, 1400); tone(1400, t + .09, .12, 'sine', .12, 2100); },
    chime: t => [1046.5, 1318.5, 1568].forEach((f, i) => tone(f, t + i * .05, .8, 'sine', .12, null, true)),
    zoom: t => tone(500, t, .06, 'sine', .08, 700),
    toggle: t => tone(1200, t, .05, 'square', .06),
    dice: t => { for (let i = 0; i < 6; i++) tone(300 + Math.random() * 900, t + i * .045, .05, 'square', .06); },
  };
  function play(name) {
    if (!S.settings.sound || !init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    try { fx[name](ctx.currentTime + .005); } catch (e) { }
  }
  const SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];
  function music(on) {
    clearInterval(musicTimer);
    if (!on || !init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    let step = 0;
    musicTimer = setInterval(() => {
      if (document.hidden) return;
      const t = ctx.currentTime + .02;
      if (step % 8 === 0) tone(SCALE[[0, 3, 4, 2][(step / 8) % 4 | 0]] / 2, t, 3.2, 'sine', .07);
      if (Math.random() < .55) tone(SCALE[Math.random() * SCALE.length | 0], t, 1.6, 'triangle', .05, null, true);
      step++;
    }, 460);
  }
  return { play, setVol, music, init };
})();

/* ---------- 設定 ---------- */
function applySettings() {
  const st = S.settings, r = document.documentElement;
  r.dataset.font = st.font;
  r.dataset.theme = st.dark ? 'dark' : 'light';
  document.body.classList.toggle('no-anim', !st.anim);
  $('#btnSound use').setAttribute('href', st.sound ? '#i-sound' : '#i-mute');
  Petals.toggle(st.petals && st.anim);
  Sound.setVol();
}
function bindSettings() {
  const st = S.settings;
  const dlg = $('#settings');
  $('#btnSettings').onclick = () => { dlg.hidden = false; Sound.play('open'); sync(); };
  $('#setClose').onclick = () => { dlg.hidden = true; Sound.play('close'); };
  dlg.onclick = e => { if (e.target === dlg) { dlg.hidden = true; } };
  function sync() {
    $$('#setFont button').forEach(b => b.classList.toggle('on', b.dataset.v === st.font));
    $('#setSound').checked = st.sound; $('#setVol').value = st.vol; $('#setMusic').checked = st.music;
    $('#setPetals').checked = st.petals; $('#setAnim').checked = st.anim; $('#setDark').checked = st.dark; $('#setText').checked = st.text;
  }
  $$('#setFont button').forEach(b => b.onclick = () => { st.font = b.dataset.v; save(); applySettings(); sync(); Sound.play('toggle'); });
  [['setSound', 'sound'], ['setPetals', 'petals'], ['setAnim', 'anim'], ['setDark', 'dark'], ['setText', 'text'], ['setMusic', 'music']].forEach(([id, key]) => {
    $('#' + id).onchange = e => {
      st[key] = e.target.checked; save(); applySettings(); Sound.play('toggle');
      if (key === 'music') Sound.music(st.music);
    };
  });
  $('#setVol').oninput = e => { st.vol = +e.target.value; save(); Sound.setVol(); };
  $('#setVol').onchange = () => Sound.play('click');
  $('#setReset').onclick = () => {
    if (!confirm('確定要清除所有閱讀紀錄、收藏與徽章嗎？')) return;
    const keep = S.settings; S = structuredClone(DEF); S.settings = keep; save(); toast('🧹', '已清除紀錄'); route();
  };
  $('#btnSound').onclick = () => { st.sound = !st.sound; save(); applySettings(); Sound.play('toggle'); toast(st.sound ? '🔊' : '🔇', st.sound ? '音效已開啟' : '音效已關閉'); };
}

/* ---------- 飄落梅花 ---------- */
const Petals = (() => {
  const cv = $('#petals'), cx = cv.getContext('2d');
  let arr = [], on = false, raf, W, H;
  const COLORS = ['#ff6b8a', '#ff9ec1', '#d7262f', '#ffd1e0', '#b99ae0', '#ffffff'];
  function resize() { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; }
  function mk(x, y, burst) {
    return { x: x ?? Math.random() * W, y: y ?? -30 - Math.random() * H, r: (5 + Math.random() * 7) * devicePixelRatio,
      vx: burst ? (Math.random() - .5) * 9 : (Math.random() - .3) * .6, vy: burst ? -Math.random() * 7 - 2 : .5 + Math.random() * 1.1,
      rot: Math.random() * 6, vr: (Math.random() - .5) * .04, sw: Math.random() * 6, c: COLORS[Math.random() * COLORS.length | 0],
      blossom: Math.random() < .35, life: burst ? 160 : Infinity };
  }
  function drawBlossom(p) {
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalAlpha = .85; cx.fillStyle = p.c;
    if (p.blossom) {
      for (let i = 0; i < 5; i++) { cx.rotate(Math.PI * 2 / 5); cx.beginPath(); cx.arc(0, -p.r * .9, p.r * .75, 0, 7); cx.fill(); }
      cx.fillStyle = '#ffd54a'; cx.beginPath(); cx.arc(0, 0, p.r * .35, 0, 7); cx.fill();
    } else {
      cx.beginPath(); cx.ellipse(0, 0, p.r * .55, p.r, 0, 0, 7); cx.fill();
    }
    cx.restore();
  }
  function frame() {
    cx.clearRect(0, 0, W, H);
    arr.forEach(p => {
      p.sw += .02; p.x += p.vx + Math.sin(p.sw) * .5 * devicePixelRatio; p.y += p.vy * devicePixelRatio; p.rot += p.vr;
      if (p.life !== Infinity) { p.vy += .12; p.vx *= .98; p.life--; }
      if (p.y > H + 30 && p.life === Infinity) Object.assign(p, mk(), { y: -30 });
      drawBlossom(p);
    });
    arr = arr.filter(p => p.life > 0 && !(p.life !== Infinity && p.y > H + 40));
    raf = arr.length ? requestAnimationFrame(frame) : null;
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function toggle(v) {
    on = v; resize();
    arr = arr.filter(p => p.life !== Infinity);
    if (v) { const n = innerWidth < 700 ? 12 : 22; for (let i = 0; i < n; i++) arr.push(mk()); start(); }
    else if (!arr.length) { cancelAnimationFrame(raf); raf = null; cx.clearRect(0, 0, W, H); }
  }
  function burst(x, y, n = 26) { if (!S.settings.anim) return; for (let i = 0; i < n; i++) arr.push(mk(x * devicePixelRatio, y * devicePixelRatio, true)); start(); }
  addEventListener('resize', resize);
  return { toggle, burst };
})();

/* ---------- 彩帶、提示 ---------- */
function confetti() {
  if (!S.settings.anim) return;
  const cv = $('#confetti'), cx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#7a4fb4', '#d7262f', '#f6b830', '#17b3a3', '#3aa3f0', '#ff6f9f', '#58b947'];
  let ps = Array.from({ length: 150 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .6, vx: (Math.random() - .5) * 16, vy: -Math.random() * 18 - 6, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.random() * cols.length | 0] }));
  let n = 0;
  (function f() {
    cx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); });
    if (++n < 170) requestAnimationFrame(f); else cx.clearRect(0, 0, cv.width, cv.height);
  })();
}
function toast(ic, msg, cls = '') {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = `<span class="t-ic">${ic}</span><span>${msg}</span>`;
  $('#toasts').append(t); setTimeout(() => { t.style.transition = '.4s'; t.style.opacity = 0; t.style.transform = 'translateY(20px)'; setTimeout(() => t.remove(), 400); }, cls ? 3800 : 2200);
}

/* ---------- 徽章 ---------- */
const BADGES = [
  { id: 'first', ic: '📖', name: '初次翻閱', desc: '打開第一個版面', bg: 'bg-purple', test: () => seenCount() >= 1 },
  { id: 'r10', ic: '🐛', name: '小書蟲', desc: '閱讀 10 個版面', bg: 'bg-teal', test: () => seenCount() >= 10 },
  { id: 'r50', ic: '🦉', name: '梅岡通', desc: '閱讀 50 個版面', bg: 'bg-sky', test: () => seenCount() >= 50 },
  { id: 'all', ic: '🏆', name: '全勤典藏家', desc: '每一期都翻閱過', bg: 'bg-gold', test: () => issuesSeen() >= ISSUES.length },
  { id: 'span', ic: '⏳', name: '穿越時空', desc: '讀過相隔 15 年以上的兩期', bg: 'bg-pink', test: () => { const ys = Object.keys(S.seen).map(k => byNo[+k.split('-')[0]]?.year).filter(Boolean); return ys.length && Math.max(...ys) - Math.min(...ys) >= 15; } },
  { id: 's5', ic: '🔍', name: '搜尋達人', desc: '進行 5 次全文檢索', bg: 'bg-plum', test: () => S.searches >= 5 },
  { id: 'fav3', ic: '⭐', name: '收藏家', desc: '收藏 3 個版面', bg: 'bg-gold', test: () => S.fav.length >= 3 },
  { id: 'g5', ic: '🕵️', name: '時光偵探', desc: '猜年份答對 5 題', bg: 'bg-leaf', test: () => S.game.correct >= 5 },
  { id: 'streak', ic: '🔥', name: '連勝高手', desc: '猜年份連續答對 5 題', bg: 'bg-plum', test: () => S.game.bestStreak >= 5 },
  { id: 'zoom', ic: '🔬', name: '明察秋毫', desc: '把版面放大到 400%', bg: 'bg-teal', test: () => S.zoomMax >= 4 },
  { id: 'hd', ic: '🖼️', name: '原汁原味', desc: '載入一次原始高解析圖', bg: 'bg-sky', test: () => S.hd >= 1 },
  { id: 'night', ic: '🌙', name: '夜讀梅岡', desc: '晚上 10 點後閱讀', bg: 'bg-purple', test: () => S.night },
];
function seenCount() { return Object.keys(S.seen).length; }
function issuesSeen() { return new Set(Object.keys(S.seen).map(k => k.split('-')[0])).size; }
function checkBadges() {
  BADGES.forEach(b => {
    if (!S.badges.includes(b.id) && b.test()) {
      S.badges.push(b.id); save();
      setTimeout(() => { Sound.play('badge'); confetti(); toast(b.ic, `獲得徽章「${b.name}」！${b.desc}`, 'badge-t'); }, 400);
    }
  });
}

/* ---------- 搜尋核心 ---------- */
const PUNCT = '[\\s,，.。、;；:：!！?？「」『』()（）\\-—–_~·‧\'"“”‘’/|]*';
const VARIANT = { '台': '[台臺]', '臺': '[台臺]', '里': '[里裡]', '裡': '[里裡]', '峰': '[峰峯]', '群': '[群羣]', '線': '[線綫]', '著': '[著着]', '為': '[為爲]', '眾': '[眾衆]', '梅': '[梅楳挴]' };
function termRegex(term) {
  const chars = [...term.replace(/\s+/g, '')];
  if (!chars.length) return null;
  const parts = chars.map(c => {
    const h = c.replace(/[Ａ-Ｚａ-ｚ０-９]/g, x => String.fromCharCode(x.charCodeAt(0) - 0xFEE0));
    if (VARIANT[c]) return VARIANT[c];
    if (/[a-z0-9]/i.test(h)) { const f = String.fromCharCode(h.charCodeAt(0) + 0xFEE0); return `[${h.toLowerCase()}${h.toUpperCase()}${f}]`; }
    return h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(parts.join(PUNCT), 'gi');
}
function parseTerms(q) { return (q || '').trim().split(/[\s　]+/).filter(Boolean).slice(0, 6); }
function matchLine(text, res) {
  const out = [];
  res.forEach((re, ti) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { out.push([m.index, m.index + m[0].length, ti]); if (!m[0].length) re.lastIndex++; } });
  return out;
}
function highlight(text, res) {
  const ms = matchLine(text, res).sort((a, b) => a[0] - b[0]);
  let s = '', last = 0;
  ms.forEach(([a, b]) => { if (a < last) return; s += esc(text.slice(last, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; last = b; });
  return s + esc(text.slice(last));
}
function searchPages(q, f = {}) {
  const res = parseTerms(q).map(termRegex).filter(Boolean);
  if (!res.length) return [];
  const out = [];
  PAGES.forEach(pg => {
    const iss = pg.iss;
    if (f.y1 && iss.year < f.y1) return; if (f.y2 && iss.year > f.y2) return;
    if (f.p && pg.p !== f.p) return; if (f.sec && pg.sec !== f.sec) return;
    const found = new Set(); let hits = 0; const lines = [];
    pg.L.forEach((l, li) => { const ms = matchLine(l[0], res); if (ms.length) { hits += ms.length; ms.forEach(m => found.add(m[2])); lines.push(li); } });
    // 行與行之間斷開的詞：退而用整版文字比對
    if (found.size < res.length) {
      const all = pg.L.map(l => l[0]).join('');
      res.forEach((re, ti) => { if (!found.has(ti)) { re.lastIndex = 0; if (re.test(all)) { found.add(ti); hits++; } } });
    }
    if (found.size === res.length) {
      const inHead = pg.heads.some(h => res.some(re => { re.lastIndex = 0; return re.test(h); }));
      out.push({ pg, hits, lines, score: hits + (inHead ? 5 : 0) });
    }
  });
  return out;
}

/* ---------- 路由 ---------- */
let curBase = null;
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1) || '/');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = {}; (qs || '').split('&').filter(Boolean).forEach(kv => { const [k, v = ''] = kv.split('='); q[k] = v; });
  return { parts, q, path };
}
function route() {
  const { parts, q } = parseHash();
  const view = parts[0] || 'home';
  if (view === 'read') {
    const pg = findPage(+parts[1], +parts[2]);
    if (!pg) { location.hash = '#/issues'; return; }
    if (!curBase) { renderView('issue', [String(pg.iss.no)], {}); curBase = 'issue/' + pg.iss.no; Reader.fromApp = false; }
    Reader.open(pg, q.q || '');
    return;
  }
  if (Reader.isOpen) Reader.hide();
  const base = parts.join('/') + '?' + JSON.stringify(q);
  if (base === curBase) return;
  curBase = base;
  renderView(view, parts.slice(1), q);
}
function renderView(view, args, q) {
  const V = { home: vHome, issues: vIssues, issue: vIssue, search: vSearch, timeline: vTimeline, game: vGame, me: vMe, help: vHelp };
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === (view === 'issue' ? 'issues' : view)));
  main.innerHTML = '';
  (V[view] || vHome)(args, q);
  if (!Reader.isOpen) window.scrollTo({ top: 0 });
  footStat();
}
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function footStat() { $('#footStat').textContent = `收錄 ${ISSUES.length} 期、${PAGES.length} 個版面 ‧ 資料更新：${DATA.built || '—'}`; }

/* ---------- 首頁 ---------- */
function vHome() {
  const totalChars = PAGES.reduce((s, p) => s + p.chars, 0);
  const covers = ISSUES.slice(-3).map(i => i.pages[0]);
  const lastYear = YEARS[YEARS.length - 1], firstYear = YEARS[0];
  main.innerHTML = `
  <section class="hero">
    <svg class="hero-deco d1"><use href="#i-blossom"/></svg><svg class="hero-deco d2"><use href="#i-blossom"/></svg>
    <div class="hero-left">
      <span class="hero-kicker"><img src="assets/badge.png" alt="">國立楊梅高級中等學校 ‧ 校刊</span>
      <div class="hero-logo-wrap"><img class="hero-logo" src="assets/logo.png" alt="梅岡風"></div>
      <h1>楊梅高中梅岡風</h1>
      <p class="lead">從 ${firstYear || ''} 年到 ${lastYear || ''} 年，${ISSUES.length} 期校刊記錄了梅岡的點點滴滴。翻開版面、搜尋關鍵字，找回屬於你的梅高記憶！</p>
      <div class="hero-btns">
        <a class="btn" href="${pageUrl(latest.pages[0])}"><svg><use href="#i-book"/></svg>閱讀最新一期</a>
        <a class="btn" href="#/issues"><svg><use href="#i-grid"/></svg>瀏覽全部期別</a>
        <button class="btn gold" id="luckyBtn"><svg><use href="#i-dice"/></svg>隨機翻一版</button>
      </div>
    </div>
    <div class="hero-right">
      <div class="hero-stack">${covers.map(pg => `<img src="${thumb(pg)}" alt="${issueLabel(pg.iss)}封面" data-go="${pageUrl(pg)}">`).join('')}</div>
      <img class="hero-badge-float" src="assets/badge.png" alt="校徽" id="heroBadge" title="點我看看！">
    </div>
  </section>
  <section class="stats">
    ${stat('bg-purple', 'i-book', ISSUES.length, '期校刊', 'c-purple')}
    ${stat('bg-plum', 'i-grid', PAGES.length, '個版面', 'c-plum')}
    ${stat('bg-gold', 'i-time', (lastYear - firstYear + 1) || 0, '年的歷史', 'c-gold')}
    ${stat('bg-teal', 'i-text', Math.round(totalChars / 10000), '萬字可檢索', 'c-teal')}
  </section>

  <h2 class="sec-title"><span class="dot bg-plum"><svg><use href="#i-star"/></svg></span>最新一期 <small>${issueLabel(latest)} ‧ ${dateLabel(latest)}</small></h2>
  <div class="home-grid">
    <div class="card feature">
      <img class="cover" src="${thumb(latest.pages[0])}" alt="最新一期封面" data-go="${pageUrl(latest.pages[0])}">
      <div>
        <span class="tag">NEW</span><span class="tag alt">${latest.pages.length} 個版面</span>
        <h3 style="margin-top:10px">${issueLabel(latest)}${latest.title ? '：' + esc(latest.title) : ''}</h3>
        <ul class="heads-list">${latest.pages.flatMap(p => p.heads.slice(0, 1).map(h => `<li>${esc(h)} <small class="muted">（${esc(p.sec)}）</small></li>`)).slice(0, 5).join('') || '<li>點選封面開始閱讀</li>'}</ul>
        <div class="pages-mini">${latest.pages.map(p => `<img src="${thumb(p)}" alt="${pageLabel(p)}" title="${pageLabel(p)} ${esc(p.sec)}" data-go="${pageUrl(p)}">`).join('')}</div>
        <p style="margin-top:16px"><a class="btn plum" href="#/issue/${latest.no}">看這一期 <svg><use href="#i-right"/></svg></a></p>
      </div>
    </div>
    <div class="card daily">
      <h3>🌸 今日一版</h3>
      <p class="muted" id="dailyTxt" style="margin:0"></p>
      <img class="pick" id="dailyImg" alt="今日推薦版面">
      <div><button class="btn ghost" id="dailyNext"><svg><use href="#i-dice"/></svg>換一張</button> <a class="btn" id="dailyGo">閱讀</a></div>
    </div>
  </div>

  <h2 class="sec-title"><span class="dot bg-teal"><svg><use href="#i-search"/></svg></span>探索梅岡風</h2>
  <div class="explore">
    <a href="#/search" class="bg-purple"><svg><use href="#i-search"/></svg><b>全文檢索</b><span>輸入人名、活動、社團，一次找遍所有期別</span></a>
    <a href="#/timeline" class="bg-plum"><svg><use href="#i-time"/></svg><b>時光軸</b><span>依年份回顧每一期的重要報導</span></a>
    <a href="#/game" class="bg-teal"><svg><use href="#i-game"/></svg><b>猜猜哪一年</b><span>看版面局部，猜出年份拿徽章</span></a>
    <a href="#/me" class="bg-sky"><svg><use href="#i-star"/></svg><b>我的收藏</b><span>閱讀足跡、收藏版面與成就徽章</span></a>
  </div>

  <h2 class="sec-title"><span class="dot bg-gold"><svg><use href="#i-list"/></svg></span>版面專欄 <small>點選專欄名稱搜尋相關版面</small></h2>
  <div class="card cloud">${SECS.map(([s, n]) => `<a class="chip" style="--w:${Math.min(1, n / SECS[0][1])}" href="#/search?sec=${encodeURIComponent(s)}">${esc(s)} <small>${n}</small></a>`).join('')}</div>
  `;
  $$('[data-go]').forEach(el => el.onclick = () => { Reader.fromApp = true; go(el.dataset.go); });
  $('#luckyBtn').onclick = () => { Sound.play('dice'); const pg = PAGES[Math.random() * PAGES.length | 0]; Reader.fromApp = true; setTimeout(() => go(pageUrl(pg)), 250); };
  $('#heroBadge').onclick = e => { Sound.play('chime'); Petals.burst(e.clientX, e.clientY, 40); };
  // 今日一版：依日期固定，按鈕可換
  let seed = +new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const setDaily = (pg, anim) => {
    const img = $('#dailyImg'); img.src = thumb(pg); img.onclick = () => { Reader.fromApp = true; go(pageUrl(pg)); };
    $('#dailyGo').href = pageUrl(pg); $('#dailyGo').onclick = () => { Reader.fromApp = true; };
    $('#dailyTxt').textContent = `${issueLabel(pg.iss)} ‧ ${pageLabel(pg)} ‧ ${pg.sec}（${pg.iss.year || ''}）`;
    if (anim) { img.classList.remove('flip'); void img.offsetWidth; img.classList.add('flip'); }
  };
  setDaily(PAGES[seed % PAGES.length]);
  $('#dailyNext').onclick = () => { Sound.play('flip'); setDaily(PAGES[Math.random() * PAGES.length | 0], true); };
  countUp();
}
function stat(bg, ic, n, label, c) { return `<div class="card stat ${c}"><span class="ic ${bg}"><svg><use href="#${ic}"/></svg></span><div><b data-count="${n}">0</b><span>${label}</span></div></div>`; }
function countUp() {
  $$('[data-count]').forEach(el => {
    const n = +el.dataset.count; if (!S.settings.anim) { el.textContent = n.toLocaleString(); return; }
    const t0 = performance.now();
    (function f(t) { const k = Math.min(1, (t - t0) / 1300); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))).toLocaleString(); if (k < 1) requestAnimationFrame(f); })(t0);
  });
}

/* ---------- 期別瀏覽 ---------- */
function vIssues(args, q) {
  const view = q.view || 'grid', sort = q.sort || 'desc', y = +q.y || 0;
  let list = ISSUES.filter(i => !y || i.year === y);
  if (sort === 'desc') list = list.slice().reverse();
  const qs = o => '#/issues?' + Object.entries(Object.assign({ view, sort, y }, o)).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('&');
  main.innerHTML = `
  <h1 class="sec-title" style="margin-top:6px"><span class="dot bg-purple"><svg><use href="#i-book"/></svg></span>期別瀏覽 <small>共 ${ISSUES.length} 期，點選封面進入</small></h1>
  <div class="card toolbar">
    <div class="years"><a class="chip ${!y ? 'on' : ''}" href="${qs({ y: 0 })}">全部</a>${YEARS.map(yy => `<a class="chip ${y === yy ? 'on' : ''}" href="${qs({ y: yy })}">${yy}</a>`).join('')}</div>
    <span class="grow"></span>
    <form id="jumpF" style="display:flex;gap:6px;align-items:center"><label for="jumpN">跳到第</label><input type="number" id="jumpN" min="1" style="width:80px" placeholder="${latest.no}"><span>期</span></form>
    <a class="chip" href="${qs({ sort: sort === 'desc' ? 'asc' : 'desc' })}">${sort === 'desc' ? '新 → 舊' : '舊 → 新'} ⇅</a>
    <a class="chip ${view === 'grid' ? 'on' : ''}" href="${qs({ view: 'grid' })}" title="格狀"><svg><use href="#i-grid"/></svg></a>
    <a class="chip ${view === 'list' ? 'on' : ''}" href="${qs({ view: 'list' })}" title="清單"><svg><use href="#i-list"/></svg></a>
  </div>
  <div class="${view === 'grid' ? 'issue-grid' : 'issue-list'}" id="issueWrap"></div>`;
  const wrap = $('#issueWrap');
  wrap.innerHTML = list.map((iss, i) => {
    const seen = iss.pages.filter(p => S.seen[p.k]).length;
    if (view === 'grid') return `<a class="issue-card" style="--i:${i}" href="#/issue/${iss.no}">
      <div class="no">No.${pad(iss.no)}</div>${seen ? `<span class="seen">已讀 ${seen}/${iss.pages.length}</span>` : ''}
      <div class="paper"><img loading="lazy" src="${thumb(iss.pages[0])}" alt="${issueLabel(iss)}封面"></div>
      <div class="info"><b>${issueLabel(iss)}</b><span>${iss.year ? iss.year + '.' + pad(iss.month) : ''}</span></div></a>`;
    return `<a class="card issue-row" style="--i:${i};text-decoration:none;color:inherit" href="#/issue/${iss.no}">
      <img loading="lazy" src="${thumb(iss.pages[0])}" alt="">
      <div><div class="big">No.${pad(iss.no)}</div><div class="muted">${dateLabel(iss)}</div></div>
      <div class="ihl">${iss.pages.flatMap(p => p.heads.slice(0, 1)).slice(0, 3).map(esc).join('<br>') || iss.pages.map(p => esc(p.sec)).join('、')}</div>
      <span class="chip go">${iss.pages.length} 版${seen ? ` ‧ 已讀 ${seen}` : ''}</span></a>`;
  }).join('') || '<div class="empty">此年份沒有期別</div>';
  $$('#issueWrap a').forEach(a => a.addEventListener('click', () => Sound.play('click')));
  $('#jumpF').onsubmit = e => { e.preventDefault(); const n = +$('#jumpN').value; if (byNo[n]) { Sound.play('click'); go('#/issue/' + n); } else { Sound.play('bad'); toast('🤔', `找不到第 ${n} 期`); } };
}

/* ---------- 單期 ---------- */
function vIssue(args) {
  const iss = byNo[+args[0]];
  if (!iss) { main.innerHTML = `<div class="empty"><svg><use href="#i-blossom"/></svg>找不到這一期</div>`; return; }
  const idx = ISSUES.indexOf(iss), prev = ISSUES[idx - 1], next = ISSUES[idx + 1];
  main.innerHTML = `
  <div class="card issue-head">
    <div class="num"><small>梅岡風</small>No.${pad(iss.no)}</div>
    <div><h1>${issueLabel(iss)}${iss.title ? '：' + esc(iss.title) : ''}</h1><div class="muted">${dateLabel(iss)} ‧ 共 ${iss.pages.length} 個版面${iss.note ? ' ‧ ' + esc(iss.note) : ''}</div></div>
    <div class="nav2">
      ${prev ? `<a class="btn ghost" href="#/issue/${prev.no}"><svg><use href="#i-left"/></svg>第 ${prev.no} 期</a>` : ''}
      ${next ? `<a class="btn ghost" href="#/issue/${next.no}">第 ${next.no} 期<svg><use href="#i-right"/></svg></a>` : ''}
      <a class="btn plum" href="${pageUrl(iss.pages[0])}" data-read><svg><use href="#i-book"/></svg>從頭閱讀</a>
    </div>
  </div>
  <div class="page-grid">${iss.pages.map((pg, i) => `
    <div class="page-card" style="--i:${i}" data-go="${pageUrl(pg)}" tabindex="0" role="button" aria-label="${pageLabel(pg)} ${esc(pg.sec)}">
      <div class="paper"><img loading="lazy" src="${thumb(pg)}" alt="${pageLabel(pg)}">
        <div class="lens"><div><svg><use href="#i-search"/></svg>點我閱讀</div></div>${S.fav.includes(pg.k) ? '<span class="seen" style="background:var(--gold);color:#3b2800">★ 收藏</span>' : ''}</div>
      <h3><span class="pn">${pageLabel(pg)}</span>${esc(pg.sec)}</h3>
      <p>${pg.heads.slice(0, 3).map(esc).join('、') || '&nbsp;'}</p>
    </div>`).join('')}</div>`;
  $$('[data-go]').forEach(el => {
    el.onclick = () => { Reader.fromApp = true; go(el.dataset.go); };
    el.onkeydown = e => { if (e.key === 'Enter') el.click(); };
  });
  $('[data-read]').onclick = () => { Reader.fromApp = true; };
  $$('.nav2 .ghost').forEach(a => a.onclick = () => Sound.play('flip'));
}

/* ---------- 全文檢索 ---------- */
function vSearch(args, q) {
  const query = q.q || '', f = { y1: +q.y1 || 0, y2: +q.y2 || 0, p: +q.p || 0, sec: q.sec || '' }, sort = q.sort || 'score';
  const opt = (v, l, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
  const SUG = ['繁星', '校慶', '科展', '畢業典禮', '社團', '管樂', '體育班', '國際交流', '技藝競賽', '校長', '圖書館', '運動會'];
  main.innerHTML = `
  <section class="search-hero">
    <h1><svg><use href="#i-search"/></svg>全文檢索</h1>
    <form class="search-box" id="sForm"><svg><use href="#i-search"/></svg>
      <input id="sQ" type="search" value="${esc(query)}" placeholder="輸入關鍵字，多個關鍵字請用空白隔開" aria-label="搜尋關鍵字" autocomplete="off">
      <button class="btn plum" type="submit">搜尋</button></form>
    <div class="search-tips"><span>熱門：</span>${SUG.map(s => `<a class="chip" href="#/search?q=${encodeURIComponent(s)}">${s}</a>`).join('')}</div>
    ${S.recentQ.length ? `<div class="search-tips"><span>最近：</span>${S.recentQ.map(s => `<a class="chip" href="#/search?q=${encodeURIComponent(s)}">${esc(s)}</a>`).join('')}</div>` : ''}
  </section>
  <div class="card filters">
    <label>年份 <select id="fy1">${opt(0, '不限', f.y1)}${YEARS.map(y => opt(y, y, f.y1)).join('')}</select> 至 <select id="fy2">${opt(0, '不限', f.y2)}${YEARS.map(y => opt(y, y, f.y2)).join('')}</select></label>
    <label>版序 <select id="fp">${opt(0, '全部', f.p)}${Array.from({ length: MAXP }, (_, i) => opt(i + 1, `第${PAGE_CN[i + 1] || i + 1}版`, f.p)).join('')}</select></label>
    <label>專欄 <select id="fsec">${opt('', '全部', f.sec)}${SECS.map(([s]) => opt(esc(s), esc(s), esc(f.sec))).join('')}</select></label>
    <label>排序 <select id="fsort">${opt('score', '相關度', sort)}${opt('new', '期別：新→舊', sort)}${opt('old', '期別：舊→新', sort)}</select></label>
  </div>
  <div id="sOut"></div>`;
  const doSearch = () => {
    const nq = { q: $('#sQ').value.trim(), y1: $('#fy1').value, y2: $('#fy2').value, p: $('#fp').value, sec: $('#fsec').value, sort: $('#fsort').value };
    go('#/search?' + Object.entries(nq).filter(([k, v]) => v && v !== '0' && !(k === 'sort' && v === 'score')).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'));
  };
  $('#sForm').onsubmit = e => { e.preventDefault(); Sound.play('search'); doSearch(); };
  $$('.filters select').forEach(s => s.onchange = () => { Sound.play('tick'); doSearch(); });
  const out = $('#sOut');
  if (!query && !f.sec) {
    out.innerHTML = `<div class="empty"><svg><use href="#i-blossom"/></svg>輸入關鍵字，就能從 ${ISSUES.length} 期、${PAGES.length} 個版面中找出相關報導。<br><small>小提示：「台」與「臺」會一起搜尋；多個關鍵字以空白分隔表示同時出現。</small></div>`;
    setTimeout(() => $('#sQ').focus(), 50);
    return;
  }
  let results;
  if (query) {
    results = searchPages(query, f);
    S.searches++; S.recentQ = [query, ...S.recentQ.filter(x => x !== query)].slice(0, 6); save(); checkBadges();
  } else {
    results = PAGES.filter(pg => pg.sec === f.sec && (!f.y1 || pg.iss.year >= f.y1) && (!f.y2 || pg.iss.year <= f.y2) && (!f.p || pg.p === f.p)).map(pg => ({ pg, hits: 0, lines: [], score: 0 }));
  }
  if (sort === 'new') results.sort((a, b) => b.pg.iss.no - a.pg.iss.no || a.pg.p - b.pg.p);
  else if (sort === 'old') results.sort((a, b) => a.pg.iss.no - b.pg.iss.no || a.pg.p - b.pg.p);
  else results.sort((a, b) => b.score - a.score || b.pg.iss.no - a.pg.iss.no);
  if (!results.length) {
    Sound.play('bad');
    out.innerHTML = `<div class="empty"><svg><use href="#i-blossom"/></svg>找不到「${esc(query)}」的相關版面。<br><small>試試較短的關鍵字，或放寬篩選條件。（文字為電腦辨識，少數字可能辨識錯誤）</small></div>`;
    return;
  }
  const totalHits = results.reduce((s, r) => s + r.hits, 0);
  const perIssue = ISSUES.map(iss => results.filter(r => r.pg.iss === iss).reduce((s, r) => s + Math.max(1, r.hits), 0));
  const mx = Math.max(...perIssue);
  const res = parseTerms(query).map(termRegex).filter(Boolean);
  out.innerHTML = `
  <div class="card hitchart"><h3>📊 共 <b class="c-plum">${results.length}</b> 個版面${query ? `、<b class="c-plum">${totalHits}</b> 處提到「${esc(query)}」` : `屬於「${esc(f.sec)}」`} ‧ 各期分布</h3>
    <div class="hitbars">${perIssue.map((n, i) => `<div class="${n ? '' : 'zero'}" style="height:${n ? Math.max(6, n / mx * 100) : 0}%;animation-delay:${i * 12}ms" title="${issueLabel(ISSUES[i])}（${ISSUES[i].year}）：${n}" data-no="${ISSUES[i].no}"></div>`).join('')}</div>
    <div class="hitaxis"><span>No.${ISSUES[0].no}（${ISSUES[0].year}）</span><span>No.${latest.no}（${latest.year}）</span></div></div>
  <div id="resList"></div><button class="btn ghost more-btn" id="moreBtn" hidden>顯示更多結果</button>`;
  let shown = 0;
  const list = $('#resList');
  function more() {
    const chunk = results.slice(shown, shown + 20);
    list.insertAdjacentHTML('beforeend', chunk.map((r, i) => {
      const pg = r.pg;
      const snips = r.lines.slice(0, 3).map(li => `<p class="snip">…${highlight(pg.L[li][0], res)}…</p>`).join('');
      return `<div class="card result" style="--i:${i}" data-go="${pageUrl(pg, query)}" data-no="${pg.iss.no}">
        <img loading="lazy" src="${thumb(pg)}" alt="">
        <div><h3>${issueLabel(pg.iss)} ‧ ${pageLabel(pg)} <span class="tag alt">${esc(pg.sec)}</span><small class="muted">${pg.iss.year || ''}.${pad(pg.iss.month)}</small>${r.hits ? `<span class="cnt">${r.hits} 處</span>` : ''}</h3>
        ${snips || `<p class="snip">${pg.heads.slice(0, 3).map(esc).join('、')}</p>`}</div></div>`;
    }).join(''));
    shown += chunk.length;
    $('#moreBtn').hidden = shown >= results.length;
    $$('.result:not([data-b])', list).forEach(el => { el.dataset.b = 1; el.onclick = () => { Reader.fromApp = true; go(el.dataset.go); }; });
  }
  more();
  $('#moreBtn').onclick = () => { Sound.play('click'); more(); };
  $$('.hitbars div[data-no]').forEach(b => b.onclick = () => {
    const no = b.dataset.no;
    while (!list.querySelector(`[data-no="${no}"]`) && shown < results.length) more();
    const el = list.querySelector(`[data-no="${no}"]`);
    if (el) { Sound.play('tick'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.animate([{ boxShadow: '0 0 0 6px #f6b830' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1400 }); }
  });
  if (query) Sound.play('ok');
}

/* ---------- 時光軸 ---------- */
function vTimeline() {
  let html = `<h1 class="sec-title" style="margin-top:6px"><span class="dot bg-plum"><svg><use href="#i-time"/></svg></span>時光軸 <small>捲動回顧梅岡風的每一期</small></h1>
  <div class="card toolbar"><div class="years">${YEARS.map(y => `<a class="chip" href="javascript:void 0" data-y="${y}">${y}</a>`).join('')}</div></div><div class="tl">`;
  let side = 0;
  YEARS.slice().reverse().forEach(y => {
    html += `<div class="tl-year" id="y${y}"><span>${y}</span></div>`;
    ISSUES.filter(i => i.year === y).reverse().forEach(iss => {
      const hs = iss.pages.flatMap(p => p.heads.slice(0, 1)).slice(0, 2);
      html += `<div class="tl-item ${side++ % 2 ? 'r' : 'l'}"><div class="card tl-card" data-go="#/issue/${iss.no}">
        <img loading="lazy" src="${thumb(iss.pages[0])}" alt=""><div><b>No.${pad(iss.no)}</b> <span class="muted">${iss.month} 月號${iss.guess ? '（推估）' : ''}</span>
        <p>${hs.map(esc).join('<br>') || iss.pages.map(p => esc(p.sec)).join('、')}</p></div></div></div>`;
    });
  });
  const undated = ISSUES.filter(i => !i.year);
  if (undated.length) html += `<div class="tl-year"><span>日期未詳</span></div>` + undated.map(iss => `<div class="tl-item l"><div class="card tl-card" data-go="#/issue/${iss.no}"><img src="${thumb(iss.pages[0])}" alt=""><div><b>No.${pad(iss.no)}</b></div></div></div>`).join('');
  main.innerHTML = html + '</div>';
  $$('.tl-card').forEach(el => el.onclick = () => { Sound.play('click'); go(el.dataset.go); });
  $$('[data-y]').forEach(a => a.onclick = () => { Sound.play('tick'); $('#y' + a.dataset.y).scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -40px 0px' });
  $$('.tl-card').forEach(el => io.observe(el));
}

/* ---------- 猜猜哪一年 ---------- */
function vGame() {
  const G = { score: 0, lives: 3, streak: 0, round: 0, pg: null, answered: false, zoom: 260 };
  main.innerHTML = `<div class="game">
    <div class="game-top"><h1 class="sec-title" style="margin:0"><span class="dot bg-teal"><svg><use href="#i-game"/></svg></span>猜猜哪一年？</h1>
      <div class="score"><div><b id="gScore">0</b><span>得分</span></div><div><b id="gStreak">0</b><span>連續答對</span></div><div><b class="hearts" id="gLives"></b><span>生命</span></div><div><b>${S.game.best}</b><span>最高分</span></div></div></div>
    <div class="card game-board" id="gBoard"></div></div>`;
  const board = $('#gBoard');
  function upd() { $('#gScore').textContent = G.score; $('#gStreak').textContent = G.streak; $('#gLives').textContent = '❤'.repeat(G.lives) + '♡'.repeat(3 - G.lives); }
  function next() {
    G.round++; G.answered = false; G.zoom = 260;
    const pool = PAGES.filter(p => p.iss.year && !p.iss.guess);
    G.pg = pool[Math.random() * pool.length | 0];
    const yr = G.pg.iss.year;
    const others = YEARS.filter(y => y !== yr).sort(() => Math.random() - .5).slice(0, 3);
    const opts = [yr, ...others].sort((a, b) => a - b);
    const lx = -(Math.random() * 150 + 5), ly = -(Math.random() * 250 + 10);
    board.innerHTML = `<div class="clip" id="gClip"><img src="${web(G.pg)}" alt="版面局部" style="left:${lx}%;top:${ly}%"></div>
      <div><div class="q-title">第 ${G.round} 題：這個版面局部出自哪一年的《梅岡風》？</div>
        <div class="opts">${opts.map(y => `<button class="opt" data-y="${y}">${y}</button>`).join('')}</div>
        <div class="feedback" id="gFb"><button class="btn ghost" id="gHint">🔍 看大一點（得分減半）</button></div></div>`;
    $$('.opt', board).forEach(b => b.onclick = () => answer(+b.dataset.y, b));
    $('#gHint').onclick = () => { if (G.zoom === 260) { G.zoom = 150; const im = $('#gClip img'); im.style.width = '150%'; im.style.left = Math.max(-50, parseFloat(im.style.left) / 2) + '%'; im.style.top = Math.max(-80, parseFloat(im.style.top) / 2) + '%'; Sound.play('zoom'); $('#gHint').disabled = true; } };
    upd();
  }
  function answer(y, btn) {
    if (G.answered) return; G.answered = true;
    const ok = y === G.pg.iss.year;
    $$('.opt', board).forEach(b => { b.disabled = true; if (+b.dataset.y === G.pg.iss.year) b.classList.add('ok'); });
    $('#gClip').classList.add('reveal');
    S.game.played++;
    if (ok) {
      const pts = (G.zoom === 260 ? 10 : 5) + G.streak * 2;
      G.score += pts; G.streak++; S.game.correct++; S.game.bestStreak = Math.max(S.game.bestStreak, G.streak);
      Sound.play('ok'); const r = btn.getBoundingClientRect(); Petals.burst(r.left + r.width / 2, r.top, 30);
    } else { btn.classList.add('bad'); G.lives--; G.streak = 0; Sound.play('bad'); }
    S.game.best = Math.max(S.game.best, G.score); save(); checkBadges(); upd();
    const link = `<a href="${pageUrl(G.pg)}" data-see>看這一版</a>`;
    $('#gFb').innerHTML = (ok ? `🎉 答對了！是 ${issueLabel(G.pg.iss)}（${G.pg.iss.year} 年 ${G.pg.iss.month} 月）${pageLabel(G.pg)}。` : `😅 可惜！答案是 ${G.pg.iss.year} 年（${issueLabel(G.pg.iss)}）。`) + ' ' + link +
      `<div style="margin-top:12px">${G.lives > 0 ? '<button class="btn teal" id="gNext">下一題 <svg><use href="#i-right"/></svg></button>' : ''}</div>`;
    $('[data-see]').onclick = () => { Reader.fromApp = true; };
    if (G.lives > 0) $('#gNext').onclick = () => { Sound.play('click'); next(); };
    else setTimeout(over, 1600);
  }
  function over() {
    const best = G.score >= S.game.best && G.score > 0;
    if (best) { Sound.play('badge'); confetti(); } else Sound.play('close');
    board.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px">
      <div style="font-size:4rem">${best ? '🏆' : '🌸'}</div><h2>遊戲結束！</h2>
      <p style="font-size:1.3rem">本次得分 <b class="c-plum" style="font-size:2rem">${G.score}</b> 分${best ? '，刷新最高紀錄！' : `（最高 ${S.game.best} 分）`}</p>
      <button class="btn plum" id="gAgain">再玩一次</button> <a class="btn ghost" href="#/me">看我的徽章</a></div>`;
    $('#gAgain').onclick = () => { Sound.play('click'); Object.assign(G, { score: 0, lives: 3, streak: 0, round: 0 }); next(); };
  }
  next();
}

/* ---------- 我的收藏 ---------- */
function vMe() {
  const n = issuesSeen(), pct = ISSUES.length ? n / ISSUES.length : 0, C = 2 * Math.PI * 52;
  const readByIssue = ISSUES.map(iss => iss.pages.filter(p => S.seen[p.k]).length);
  const favs = S.fav.map(k => PAGES.find(p => p.k === k)).filter(Boolean);
  const hist = S.hist.map(k => PAGES.find(p => p.k === k)).filter(Boolean);
  main.innerHTML = `
  <h1 class="sec-title" style="margin-top:6px"><span class="dot bg-sky"><svg><use href="#i-star"/></svg></span>我的收藏與足跡 <small>紀錄只存在這台電腦的瀏覽器中</small></h1>
  <div class="me-grid">
    <div class="card progress-ring">
      <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--lav)" stroke-width="14"/>
        <circle cx="60" cy="60" r="52" fill="none" stroke="url(#gradR)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 60 60)" id="ringArc"/>
        <defs><linearGradient id="gradR"><stop offset="0" stop-color="#7a4fb4"/><stop offset="1" stop-color="#d7262f"/></linearGradient></defs>
        <text x="60" y="68" text-anchor="middle" font-size="24" font-weight="900" fill="currentColor">${Math.round(pct * 100)}%</text></svg>
      <div><h3>典藏探索進度</h3><p style="margin:0">已翻閱 <b class="c-plum">${n}</b> / ${ISSUES.length} 期、<b class="c-plum">${seenCount()}</b> / ${PAGES.length} 個版面</p>
        <p class="muted" style="margin:6px 0 0">全文檢索 ${S.searches} 次 ‧ 猜年份最高 ${S.game.best} 分 ‧ 徽章 ${S.badges.length} / ${BADGES.length}</p></div>
    </div>
    <div class="card"><h3 style="padding:20px 20px 0">各期閱讀熱度 <small class="muted">（顏色越深讀得越多）</small></h3>
      <div class="heat">${ISSUES.map((iss, i) => { const r = readByIssue[i], lv = !r ? '' : r >= iss.pages.length ? 'h4' : r >= 3 ? 'h3' : r >= 2 ? 'h2' : 'h1'; return `<a class="${lv}" href="#/issue/${iss.no}" title="${issueLabel(iss)}：已讀 ${r}/${iss.pages.length}">${iss.no}</a>`; }).join('')}</div></div>
  </div>
  <h2 class="sec-title"><span class="dot bg-gold"><svg><use href="#i-star"/></svg></span>成就徽章</h2>
  <div class="card badges">${BADGES.map(b => `<div class="badge ${S.badges.includes(b.id) ? '' : 'lock'}"><div class="medal ${b.bg}">${b.ic}</div><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div>
  <h2 class="sec-title"><span class="dot bg-plum"><svg><use href="#i-star"/></svg></span>收藏的版面 <small>在閱讀器按 ★ 或 F 鍵收藏</small></h2>
  <div class="card">${favs.length ? `<div class="fav-grid">${favs.map(pg => `<div class="fv" data-go="${pageUrl(pg)}"><img src="${thumb(pg)}" alt=""><div>${issueLabel(pg.iss)} ${pageLabel(pg)}</div><button data-del="${pg.k}" title="移除收藏"><svg><use href="#i-x"/></svg></button></div>`).join('')}</div>` : '<div class="empty" style="padding:30px">還沒有收藏，去找喜歡的版面吧！</div>'}</div>
  <h2 class="sec-title"><span class="dot bg-teal"><svg><use href="#i-time"/></svg></span>最近閱讀</h2>
  <div class="card">${hist.length ? `<div class="fav-grid">${hist.map(pg => `<div class="fv" data-go="${pageUrl(pg)}"><img src="${thumb(pg)}" alt=""><div>${issueLabel(pg.iss)} ${pageLabel(pg)}</div></div>`).join('')}</div>` : '<div class="empty" style="padding:30px">尚無閱讀紀錄</div>'}</div>`;
  requestAnimationFrame(() => { const a = $('#ringArc'); a.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)'; a.style.strokeDashoffset = C * (1 - pct); });
  $$('.fv').forEach(el => el.onclick = e => {
    if (e.target.closest('[data-del]')) { const k = e.target.closest('[data-del]').dataset.del; S.fav = S.fav.filter(x => x !== k); save(); Sound.play('close'); curBase = null; route(); return; }
    Reader.fromApp = true; go(el.dataset.go);
  });
  $$('.badge:not(.lock)').forEach(b => b.onclick = e => { Sound.play('chime'); Petals.burst(e.clientX, e.clientY, 18); });
}

/* ---------- 使用說明 ---------- */
function vHelp() {
  main.innerHTML = `<div class="help">
  <h1 class="sec-title" style="margin-top:6px"><span class="dot bg-purple"><svg><use href="#i-help"/></svg></span>使用說明</h1>
  <div class="card"><h2>📖 瀏覽與閱讀</h2>
    <p>在「期別瀏覽」點選任一期封面，再點選版面即可開啟閱讀器。閱讀器可以：</p>
    <ul><li>滑鼠滾輪或 <kbd>+</kbd> <kbd>-</kbd> 縮放，拖曳移動，雙擊快速放大；手機可用兩指縮放。</li>
      <li><kbd>←</kbd> <kbd>→</kbd> 翻到上一版／下一版（到最後一版會接著下一期）。</li>
      <li><kbd>T</kbd> 開關右側「版面文字」，點選任一行會在版面上標示位置；<kbd>F</kbd> 收藏本版；<kbd>0</kbd> 符合視窗；<kbd>Esc</kbd> 關閉。</li>
      <li>「HD」按鈕載入原始掃描檔（檔案較大），「下載」按鈕可儲存原始圖檔。</li></ul></div>
  <div class="card"><h2>🔍 全文檢索</h2>
    <p>每個版面的文字都以電腦文字辨識（OCR）擷取，所以可以搜尋人名、活動、社團等關鍵字。多個關鍵字用空白隔開，表示要同時出現。「台／臺」等異體字會一起搜尋。搜尋結果會標示在版面上的位置。</p>
    <p class="muted">注意：辨識結果可能有少數錯字，若找不到可換個說法或縮短關鍵字。</p></div>
  <div class="card"><h2>🛠️ 新增期別（給網站管理者）</h2>
    <ol class="steps">
      <li>把新一期的掃描圖放進與網站資料夾同一層的 <code>梅岡風</code> 資料夾。</li>
      <li>檔名依照規則：<code>梅岡風45期第1版.JPG</code>、<code>梅岡風45期第2版.JPG</code>…（副檔名可省略，版數不限 4 版）。</li>
      <li>雙擊網站資料夾內的 <code>更新網站.bat</code>，程式只會處理新增或修改過的圖片，並重新辨識文字。</li>
      <li>完成後重新整理網頁即可看到新的一期，首頁、時光軸、檢索都會自動更新。</li>
    </ol>
    <p>若電腦辨識的出版日期不正確，或想替某期加上標題，可編輯 <code>data/meta.json</code>，例如：<br>
    <code>{ "45": { "date": "2026-11", "title": "創校特刊", "note": "增刊 8 版" } }</code>，存檔後再執行一次更新。</p></div>
  <div class="card"><h2>🏅 互動功能</h2>
    <p>閱讀、搜尋、收藏和「猜猜哪一年」遊戲都能獲得徽章。右上角 ⚙️ 可調整字體大小、音效、背景音樂、梅花動畫與深色模式。所有紀錄只儲存在你自己的瀏覽器中。</p></div>
  </div>`;
}

/* ---------- 閱讀器 ---------- */
const Reader = (() => {
  const el = $('#reader'), stage = $('#stage'), cv = $('#rCanvas'), img = $('#rImg'), hlL = $('#rHL');
  const R = { pg: null, s: 1, x: 0, y: 0, fit: 1, q: '', find: '', hd: false };
  const api = { isOpen: false, fromApp: false };
  let hintT;
  function setT(anim) {
    cv.classList.toggle('anim', !!anim);
    cv.style.transform = `translate(${R.x}px,${R.y}px) scale(${R.s})`;
    const z = R.s / R.fit;
    $('#rZoomVal').textContent = Math.round(z * 100) + '%';
    if (z > S.zoomMax + .01) { S.zoomMax = Math.round(z * 10) / 10; if (S.zoomMax >= 4) { save(); checkBadges(); } }
  }
  function fitView(anim) {
    const [w, h] = R.pg.wh, W = stage.clientWidth, H = stage.clientHeight;
    R.fit = Math.min((W - 40) / w, (H - 30) / h);
    R.s = R.fit; R.x = (W - w * R.s) / 2; R.y = (H - h * R.s) / 2; setT(anim);
  }
  function zoomAt(f, cx, cy, anim) {
    const ns = Math.max(R.fit * .6, Math.min(R.fit * 8, R.s * f));
    const k = ns / R.s; R.x = cx - (cx - R.x) * k; R.y = cy - (cy - R.y) * k; R.s = ns; setT(anim);
  }
  function centerOn(nx, ny, scale) {
    const [w, h] = R.pg.wh, W = stage.clientWidth, H = stage.clientHeight;
    if (scale) R.s = Math.max(R.s, scale);
    R.x = W / 2 - nx * w * R.s; R.y = H / 2 - ny * h * R.s; setT(true);
  }
  function boxes(res, cls) {
    const out = [];
    R.pg.L.forEach((l, li) => {
      matchLine(l[0], res).forEach(([a, b]) => {
        const n = l[0].length || 1, x0 = l[1] + (l[3] - l[1]) * a / n, x1 = Math.max(x0 + 4, l[1] + (l[3] - l[1]) * b / n);
        out.push({ li, x0, y0: l[2], x1, y1: l[4] });
      });
    });
    return out;
  }
  function drawHL() {
    const res = parseTerms(R.find || R.q).map(termRegex).filter(Boolean);
    hlL.innerHTML = '';
    const bs = res.length ? boxes(res) : [];
    bs.forEach((b, i) => {
      const d = document.createElement('div'); d.className = 'hl' + (i === 0 ? ' cur' : '');
      Object.assign(d.style, { left: b.x0 / 10 - .3 + '%', top: b.y0 / 10 - .25 + '%', width: (b.x1 - b.x0) / 10 + .6 + '%', height: (b.y1 - b.y0) / 10 + .5 + '%' });
      hlL.append(d);
    });
    renderLines(res);
    return bs;
  }
  function renderLines(res) {
    const pg = R.pg;
    $('#rHeads').innerHTML = pg.heads.map(h => `<button>${esc(h)}</button>`).join('');
    $$('#rHeads button').forEach((b, i) => b.onclick = () => { const li = pg.L.findIndex(l => l[0].replace(/\s/g, '') === pg.heads[i]); if (li >= 0) flashLine(li); });
    $('#rLines').innerHTML = pg.L.length ? pg.L.map((l, i) => `<p data-li="${i}" class="${l[4] - l[2] >= pg.med * 1.8 ? 'big' : ''}">${res.length ? highlight(l[0], res) : esc(l[0])}</p>`).join('')
      : '<p class="muted">（本版沒有辨識文字）</p>';
  }
  function flashLine(li) {
    const l = R.pg.L[li]; if (!l) return;
    $$('.hl.flash', hlL).forEach(x => x.remove());
    const d = document.createElement('div'); d.className = 'hl flash';
    Object.assign(d.style, { left: l[1] / 10 - .4 + '%', top: l[2] / 10 - .3 + '%', width: (l[3] - l[1]) / 10 + .8 + '%', height: (l[4] - l[2]) / 10 + .6 + '%' });
    hlL.append(d);
    centerOn((l[1] + l[3]) / 2000, (l[2] + l[4]) / 2000, R.fit * 2.6);
    Sound.play('zoom');
  }
  function load(pg, q, isTurn) {
    R.pg = pg; R.q = q; R.find = ''; R.hd = false; $('#rFind').value = '';
    const iss = pg.iss;
    $('#rTitle').textContent = `梅岡風 ${issueLabel(iss)} ‧ ${pageLabel(pg)} ‧ ${pg.sec}　${iss.year ? `(${iss.year}.${pad(iss.month)})` : ''}`;
    cv.style.width = pg.wh[0] + 'px'; cv.style.height = pg.wh[1] + 'px';
    $('#rLoading').hidden = false;
    img.onload = () => { $('#rLoading').hidden = true; };
    img.onerror = () => { $('#rLoading').hidden = true; };
    img.src = web(pg); img.alt = `${issueLabel(iss)} ${pageLabel(pg)}`;
    $('#rDown').href = SRC_DIR + encodeURIComponent(pg.f); $('#rDown').setAttribute('download', pg.f);
    $('#rHD').classList.remove('on');
    $('#rFav').classList.toggle('on', S.fav.includes(pg.k));
    fitView(false);
    if (isTurn) { cv.classList.remove('turn'); void cv.offsetWidth; cv.classList.add('turn'); }
    const bs = drawHL();
    if (bs.length && q) setTimeout(() => centerOn((bs[0].x0 + bs[0].x1) / 2000, (bs[0].y0 + bs[0].y1) / 2000, R.fit * 2.2), 350);
    $('#rStrip').innerHTML = iss.pages.map(p => `<img src="${thumb(p)}" class="${p === pg ? 'on' : ''}" title="${pageLabel(p)} ${esc(p.sec)}" data-p="${p.p}" alt="${pageLabel(p)}">`).join('');
    $$('#rStrip img').forEach(t => t.onclick = () => turnTo(iss.pages.find(p => p.p === +t.dataset.p)));
    const flat = PAGES.indexOf(pg);
    $('#rPrev').style.visibility = flat > 0 ? '' : 'hidden'; $('#rNext').style.visibility = flat < PAGES.length - 1 ? '' : 'hidden';
    // 足跡
    S.seen[pg.k] = (S.seen[pg.k] || 0) + 1;
    S.hist = [pg.k, ...S.hist.filter(k => k !== pg.k)].slice(0, 12);
    if (new Date().getHours() >= 22) S.night = true;
    save(); checkBadges();
    const next = PAGES[flat + 1]; if (next) new Image().src = web(next);
  }
  function turnTo(pg, dir) {
    if (!pg || pg === R.pg) return;
    Sound.play('flip');
    history.replaceState(null, '', pageUrl(pg));
    load(pg, '', true);
  }
  function step(d) { const i = PAGES.indexOf(R.pg) + d; if (PAGES[i]) { if (PAGES[i].iss !== R.pg.iss) toast('📰', `進入${issueLabel(PAGES[i].iss)}`); turnTo(PAGES[i], d); } }
  api.open = (pg, q) => {
    if (!api.isOpen) {
      el.hidden = false; api.isOpen = true; document.body.style.overflow = 'hidden'; Sound.play('open');
      $('#rSide').hidden = !(S.settings.text || q); $('#rText').classList.toggle('on', !$('#rSide').hidden);
      $('#rHint').style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => $('#rHint').style.opacity = 0, 3500);
    }
    if (q) { $('#rSide').hidden = false; $('#rText').classList.add('on'); }
    requestAnimationFrame(() => load(pg, q));
  };
  api.hide = () => { el.hidden = true; api.isOpen = false; document.body.style.overflow = ''; if (document.fullscreenElement) document.exitFullscreen(); };
  function close() {
    Sound.play('close');
    const no = R.pg.iss.no; api.hide();
    if (api.fromApp) { api.fromApp = false; history.back(); }
    else { history.replaceState(null, '', '#/issue/' + no); curBase = null; route(); }
  }
  // 事件
  $('#rClose').onclick = close;
  $('#rPrev').onclick = () => step(-1); $('#rNext').onclick = () => step(1);
  $('#rZoomIn').onclick = () => { Sound.play('zoom'); zoomAt(1.4, stage.clientWidth / 2, stage.clientHeight / 2, true); };
  $('#rZoomOut').onclick = () => { Sound.play('zoom'); zoomAt(1 / 1.4, stage.clientWidth / 2, stage.clientHeight / 2, true); };
  $('#rFit').onclick = () => { Sound.play('zoom'); fitView(true); };
  $('#rText').onclick = () => { const s = $('#rSide'); s.hidden = !s.hidden; $('#rText').classList.toggle('on', !s.hidden); Sound.play('toggle'); setTimeout(() => fitView(true), 30); };
  $('#rFav').onclick = () => {
    const k = R.pg.k, on = !S.fav.includes(k);
    S.fav = on ? [k, ...S.fav] : S.fav.filter(x => x !== k); save();
    $('#rFav').classList.toggle('on', on); Sound.play(on ? 'chime' : 'close');
    toast(on ? '⭐' : '☆', on ? '已加入收藏' : '已取消收藏'); if (on) { const r = $('#rFav').getBoundingClientRect(); Petals.burst(r.left + 20, r.top + 30, 16); }
    checkBadges();
  };
  $('#rHD').onclick = () => {
    if (R.hd) return; R.hd = true; $('#rHD').classList.add('on'); $('#rLoading').hidden = false;
    toast('🖼️', '正在載入原始高解析圖（檔案較大，請稍候）');
    const hi = new Image();
    hi.onload = () => { if (R.hd) { img.src = hi.src; $('#rLoading').hidden = true; S.hd++; save(); checkBadges(); Sound.play('chime'); } };
    hi.onerror = () => { $('#rLoading').hidden = true; toast('⚠️', '找不到原始圖檔'); };
    hi.src = SRC_DIR + encodeURIComponent(R.pg.f);
  };
  $('#rFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); Sound.play('toggle'); };
  $('#rFind').oninput = e => { R.find = e.target.value; const bs = drawHL(); if (bs.length) centerOn((bs[0].x0 + bs[0].x1) / 2000, (bs[0].y0 + bs[0].y1) / 2000, R.fit * 2.2); };
  $('#rLines').onclick = e => { const p = e.target.closest('[data-li]'); if (p) flashLine(+p.dataset.li); };
  addEventListener('resize', () => { if (api.isOpen) fitView(); });
  document.addEventListener('fullscreenchange', () => setTimeout(() => api.isOpen && fitView(), 80));
  stage.addEventListener('wheel', e => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const ptr = new Map(); let last = null, pinch = null, moved = false;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.r-nav')) return;
    stage.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
    if (ptr.size === 1) { last = [e.clientX, e.clientY]; stage.classList.add('drag'); }
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: R.s }; }
  });
  stage.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 2 && pinch) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = stage.getBoundingClientRect();
      zoomAt(pinch.s * d / pinch.d / R.s, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); moved = true;
    } else if (last) {
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      R.x += dx; R.y += dy; last = [e.clientX, e.clientY]; setT();
    }
  });
  const up = e => {
    const wasDrag = last && ptr.size === 1; ptr.delete(e.pointerId);
    if (ptr.size < 2) pinch = null;
    if (!ptr.size) { stage.classList.remove('drag'); last = null; }
    // 手機：在符合視窗時左右滑動翻頁
    if (wasDrag && e.pointerType !== 'mouse' && Math.abs(R.s - R.fit) < .01) { const dx = e.clientX - (downX ?? e.clientX); if (Math.abs(dx) > 70) step(dx < 0 ? 1 : -1); }
  };
  let downX = null; stage.addEventListener('pointerdown', e => { downX = e.clientX; }, true);
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', e => {
    const r = stage.getBoundingClientRect();
    if (R.s > R.fit * 1.5) fitView(true); else zoomAt(2.5 * R.fit / R.s, e.clientX - r.left, e.clientY - r.top, true);
    Sound.play('zoom');
  });
  document.addEventListener('keydown', e => {
    if (!api.isOpen || e.target.matches('input')) { if (api.isOpen && e.key === 'Escape') e.target.blur(); return; }
    const k = e.key;
    if (k === 'Escape') close();
    else if (k === 'ArrowRight' || k === 'PageDown') step(1);
    else if (k === 'ArrowLeft' || k === 'PageUp') step(-1);
    else if (k === '+' || k === '=') $('#rZoomIn').click();
    else if (k === '-') $('#rZoomOut').click();
    else if (k === '0') $('#rFit').click();
    else if (k === 't' || k === 'T') $('#rText').click();
    else if (k === 'f' || k === 'F') $('#rFav').click();
    else if (k === 'ArrowUp') { R.y += 80; setT(true); }
    else if (k === 'ArrowDown') { R.y -= 80; setT(true); }
    else return;
    e.preventDefault();
  });
  return api;
})();

/* ---------- 啟動 ---------- */
$('#quickSearch').onsubmit = e => { e.preventDefault(); const v = $('#quickQ').value.trim(); if (!v) return; Sound.play('search'); go('#/search?q=' + encodeURIComponent(v)); $('#quickQ').blur(); };
$$('.nav a').forEach(a => a.addEventListener('click', () => Sound.play('click')));
$$('.nav a').forEach(a => a.addEventListener('mouseenter', () => Sound.play('tick')));
$('.brand').addEventListener('click', e => { Sound.play('chime'); Petals.burst(e.clientX, e.clientY, 20); });
document.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.matches('input, textarea') && !Reader.isOpen) { e.preventDefault(); const i = $('#sQ') || $('#quickQ'); i.focus(); }
});
// 瀏覽器限制：需使用者互動後才能播放聲音
document.addEventListener('pointerdown', function once() { Sound.init(); if (S.settings.music) Sound.music(true); document.removeEventListener('pointerdown', once); });
bindSettings();
applySettings();
if (!ISSUES.length) {
  main.innerHTML = `<div class="empty"><svg><use href="#i-blossom"/></svg>尚未產生資料。請先執行「更新網站.bat」。</div>`;
} else {
  addEventListener('hashchange', route);
  route();
}
})();
