# 生成安装包的全流程：检查工作区没有未提交的改动 → 构建内核 → pnpm pack 打出 tarball → 组装应用目录 →
# electron-builder 生成 NSIS 安装包与便携 zip。产物在 build\dist\。安装包只带内核，不带任何插件。
# 输入全部来自本仓（内核 tarball、devDependencies 里的 electron），不从包源下载内核——发版就是发 exe
# （打包步骤与验证见文档站的「开发」页）
param([string]$KernelDir = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent))

$ErrorActionPreference = 'Stop'
$installer = Split-Path $PSScriptRoot -Parent

# 国内网络用的备用镜像；环境里已设置的优先
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
  $env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
}

# 原生命令失败就立即停止——出过一次组装目录是空的却继续打包的事故（npm EUNSUPPORTEDPROTOCOL
# 没有让脚本停下），不能再有
function Assert-LastExit([string]$what, [int]$ok = 0) {
  if ($LASTEXITCODE -ne $ok) { throw "$what 失败（退出码 $LASTEXITCODE）" }
}

# 打包用的是仓里的代码，有未提交改动时打出来的 exe 说不清装了什么（未跟踪的新文件不拦）
$dirty = git -C $KernelDir status --porcelain | Where-Object { $_ -notmatch '^\?\?' }
if ($dirty) { throw "内核仓有已跟踪文件的未提交改动，先提交或暂存：`n$($dirty -join "`n")" }

Write-Host '== 构建内核'
Push-Location "$KernelDir\apps\desktop"
pnpm build
Assert-LastExit '构建内核'
Pop-Location

Write-Host '== pnpm pack（workspace: 协议由 pnpm 替换成实际版本——npm pack 不认，会原样打进 tarball）'
New-Item -ItemType Directory -Force "$installer\build" | Out-Null
Push-Location "$KernelDir\apps\desktop"
$tgzLine = (pnpm pack --pack-destination "$installer\build") | Select-Object -Last 1
Assert-LastExit 'pnpm pack'
Pop-Location
# pnpm pack 最后一行输出的是完整路径（npm 只输出文件名）——两种都认
$tgz = if ([System.IO.Path]::IsPathRooted($tgzLine)) { $tgzLine } else { Join-Path "$installer\build" $tgzLine }
if (-not (Test-Path $tgz)) { throw "pnpm pack 没有生成 tarball" }

$kpkg = Get-Content "$KernelDir\apps\desktop\package.json" -Raw | ConvertFrom-Json
$kver = $kpkg.version
$ever = $kpkg.devDependencies.electron
Write-Host "内核 $kver / electron $ever（electron 的版本只写在 apps\desktop 的 devDependencies 里）"

Write-Host '== 组装应用目录（build\app）'
$appdir = "$installer\build\app"
Remove-Item -Recurse -Force $appdir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $appdir | Out-Null
Copy-Item "$installer\app-template\package.json", "$installer\app-template\bootstrap.mjs" $appdir
# 替换两处占位：version → 内核版本（产物文件名用它）；__TGZ__ → tarball 的相对路径
# （appdir 在 build\app，tarball 在 build\ 下）。依赖必须写进清单——electron-builder
# 按清单收集 node_modules，--no-save 装的包它不收，打出来的 asar 里就没有内核（出过这个问题）
$tgzRel = '../' + [System.IO.Path]::GetFileName($tgz)
(Get-Content "$appdir\package.json" -Raw) `
  -replace '"version": "0.0.0"', ('"version": "' + $kver + '"') `
  -replace '"file:__TGZ__"', ('"file:' + $tgzRel + '"') |
  Set-Content "$appdir\package.json"
Push-Location $appdir
npm install --no-fund --no-audit
Assert-LastExit '组装目录安装内核 tarball'
if (-not (Test-Path "$appdir\node_modules\@godcreator\gwb-kernel-desktop")) {
  throw '组装目录里没有内核包——上一条 npm 多半失败了，看输出'
}
Pop-Location

Write-Host '== electron-builder（electronVersion 从 apps\desktop 读出后传入）'
Push-Location $installer
if (-not (Test-Path "$installer\node_modules\electron-builder")) {
  npm install --no-fund --no-audit
  Assert-LastExit '安装 electron-builder'
}
npx electron-builder --win --config.electronVersion=$ever
Assert-LastExit 'electron-builder'
Pop-Location

Write-Host '产物：'
Get-ChildItem "$installer\build\dist" -File |
  Where-Object { $_.Name -match '\.(exe|zip)$' } |
  ForEach-Object { Write-Host ("  {0}  {1:N1} MB" -f $_.Name, ($_.Length / 1MB)) }
