# 占位图标的生成器：256x256 深底白字「gwb」，PNG 装进 ICO（256px 用 PNG 是 ICO 的标准做法）。产物 icons/icon.ico 进 git；有正式图标时直接替换那个文件
param([string]$Out = (Join-Path $PSScriptRoot "..\icons\icon.ico"))

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$iconSizePixels = 256

function New-PlaceholderPngBytes {
  $bitmap = New-Object System.Drawing.Bitmap($iconSizePixels, $iconSizePixels)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = 'AntiAlias'
  $graphics.TextRenderingHint = 'AntiAliasGridFit'
  # 与 main.ts 的窗口底色、index.html 的页面底色是同一个值 #151518
  $graphics.Clear([System.Drawing.Color]::FromArgb(255, 21, 21, 24))
  $font = New-Object System.Drawing.Font('Segoe UI', 88, [System.Drawing.FontStyle]::Bold)
  $centered = New-Object System.Drawing.StringFormat
  $centered.Alignment = 'Center'
  $centered.LineAlignment = 'Center'
  $wholeCanvas = New-Object System.Drawing.RectangleF(0, 0, $iconSizePixels, $iconSizePixels)
  $graphics.DrawString('gwb', $font, [System.Drawing.Brushes]::White, $wholeCanvas, $centered)
  $graphics.Dispose()

  $pngStream = New-Object System.IO.MemoryStream
  $bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  return , $pngStream.ToArray()
}

# ICO 文件 = ICONDIR（6 字节）+ 一条 ICONDIRENTRY（16 字节）+ PNG 原文；宽高 256 在目录项里写 0
function ConvertTo-IcoBytes([byte[]]$pngBytes) {
  $iconStream = New-Object System.IO.MemoryStream
  $iconWriter = New-Object System.IO.BinaryWriter($iconStream)
  $iconWriter.Write([uint16]0); $iconWriter.Write([uint16]1); $iconWriter.Write([uint16]1)
  $iconWriter.Write([byte]0); $iconWriter.Write([byte]0)
  $iconWriter.Write([byte]0); $iconWriter.Write([byte]0)
  $iconWriter.Write([uint16]0)
  $iconWriter.Write([uint16]32)
  $iconWriter.Write([uint32]$pngBytes.Length)
  $iconWriter.Write([uint32](6 + 16))
  $iconWriter.Write($pngBytes)
  $iconBytes = $iconStream.ToArray()
  $iconWriter.Dispose()
  return , $iconBytes
}

$iconBytes = ConvertTo-IcoBytes (New-PlaceholderPngBytes)
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[System.IO.File]::WriteAllBytes($Out, $iconBytes)
Write-Host "icon -> $Out"
