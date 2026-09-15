# 占位图标的生成器：256x256 深底白字「gwb」，PNG 装进 ICO 容器（256px 用 PNG 压缩是标准做法）。
# 跑一次、产物 icons/icon.ico 进 git；有正经图标了替换文件、留着脚本换参数再生
param([string]$Out = (Join-Path $PSScriptRoot "..\icons\icon.ico"))

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
# 底色取 tokens 的 --background（#151518），与内核开窗的 backgroundColor 同一个值
$g.Clear([System.Drawing.Color]::FromArgb(255, 21, 21, 24))
$font = New-Object System.Drawing.Font('Segoe UI', 88, [System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'
$fmt.LineAlignment = 'Center'
$rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$g.DrawString('gwb', $font, [System.Drawing.Brushes]::White, $rect, $fmt)
$g.Dispose()

$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$png = $ms.ToArray()

# ICONDIR(6) + ICONDIRENTRY(16) + PNG 原文；宽高 256 在目录项里写 0
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter($ico)
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)
$w.Write([byte]0); $w.Write([byte]0)
$w.Write([byte]0); $w.Write([byte]0)
$w.Write([uint16]0)
$w.Write([uint16]32)
$w.Write([uint32]$png.Length)
$w.Write([uint32](6 + 16))
$w.Write($png)

New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[System.IO.File]::WriteAllBytes($Out, $ico.ToArray())
$w.Dispose()
Write-Host "icon -> $Out"
