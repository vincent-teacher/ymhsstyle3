# Windows built-in OCR (zh-Hant-TW) for newspaper pages.
# Usage: powershell -File ocr.ps1 <listfile>   (UTF-8 lines: "input.jpg|output.json")
param([string]$ListFile)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType=WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) {
  $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}
$lang = New-Object Windows.Globalization.Language 'zh-Hant-TW'
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) { throw 'zh-Hant-TW OCR not available' }
$lines = [System.IO.File]::ReadAllLines($ListFile, [System.Text.Encoding]::UTF8)
$i = 0
foreach ($ln in $lines) {
  if (-not $ln.Trim()) { continue }
  $i++
  $parts = $ln.Split('|'); $in = $parts[0]; $out = $parts[1]
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($in)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
  $W = $bmp.PixelWidth; $H = $bmp.PixelHeight
  $arr = New-Object System.Collections.ArrayList
  foreach ($l in $res.Lines) {
    $x0 = 1e9; $y0 = 1e9; $x1 = 0; $y1 = 0; $sb = New-Object System.Text.StringBuilder
    $prev = $null
    foreach ($wd in $l.Words) {
      $r = $wd.BoundingRect
      if ($null -ne $prev -and ($wd.Text -match '^[A-Za-z0-9]' ) -and ($prev -match '[A-Za-z0-9]$')) { [void]$sb.Append(' ') }
      [void]$sb.Append($wd.Text); $prev = $wd.Text
      if ($r.X -lt $x0) { $x0 = $r.X }; if ($r.Y -lt $y0) { $y0 = $r.Y }
      if ($r.X + $r.Width -gt $x1) { $x1 = $r.X + $r.Width }; if ($r.Y + $r.Height -gt $y1) { $y1 = $r.Y + $r.Height }
    }
    [void]$arr.Add(@($sb.ToString(), [int]($x0*1000/$W), [int]($y0*1000/$H), [int]($x1*1000/$W), [int]($y1*1000/$H)))
  }
  $json = ConvertTo-Json -InputObject @{ w = $W; h = $H; L = $arr.ToArray() } -Depth 5 -Compress
  [System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding $false))
  $stream.Dispose()
  Write-Output ("OCR {0}/{1} {2}" -f $i, $lines.Count, [System.IO.Path]::GetFileName($out))
}
