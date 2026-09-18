# 装机器全流程：树干净守卫 → 内核构建 → pnpm pack 出 tarball → 装配应用目录 →
# 种子浮动解析 → electron-builder 出 NSIS + 便携 zip。产物在 build\dist\
# 输入全是本仓（tarball 与 devDeps.electron 单源），不碰 registry——发版=发 exe
# （2026-09-15 拍板 C，判据见 SPEC.md）
param([string]$KernelDir = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent))

$ErrorActionPreference = 'Stop'
$installer = Split-Path $PSScriptRoot -Parent

# 国内网络兜底镜像；环境里已设的优先
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
  $env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
}

# 原生命令失败即炸——空着装配目录继续出包这种事发生过一次（npm EUNSUPPORTEDPROTOCOL
# 静默漏网），不能再有。robocopy 例外：退出码 0-7 都是成，单独判
function Assert-LastExit([string]$what, [int]$ok = 0) {
  if ($LASTEXITCODE -ne $ok) { throw "$what 失败（退出码 $LASTEXITCODE）" }
}

# 树干净守卫：装配吃的是仓里的代码，脏树打出来的 exe 说不清装了什么（未跟踪的新文件不挡）
$dirty = git -C $KernelDir status --porcelain | Where-Object { $_ -notmatch '^\?\?' }
if ($dirty) { throw "内核仓有已跟踪文件的未提交改动，先提交或收起来：`n$($dirty -join "`n")" }

Write-Host '== 内核构建'
Push-Location "$KernelDir\apps\desktop"
pnpm build
Assert-LastExit '内核构建'
Pop-Location

Write-Host '== pnpm pack（workspace: 协议由 pnpm 替换成实际版本——npm pack 不认，会原样打进 tarball）'
New-Item -ItemType Directory -Force "$installer\build" | Out-Null
Push-Location "$KernelDir\apps\desktop"
$tgzLine = (pnpm pack --pack-destination "$installer\build") | Select-Object -Last 1
Assert-LastExit 'pnpm pack'
Pop-Location
# pnpm pack 末行回的是完整路径（npm 只回文件名）——两种都认
$tgz = if ([System.IO.Path]::IsPathRooted($tgzLine)) { $tgzLine } else { Join-Path "$installer\build" $tgzLine }
if (-not (Test-Path $tgz)) { throw "pnpm pack 没出 tarball" }

$kpkg = Get-Content "$KernelDir\apps\desktop\package.json" -Raw | ConvertFrom-Json
$kver = $kpkg.version
$ever = $kpkg.devDependencies.electron
Write-Host "内核 $kver / electron $ever（electron 单一真源：apps\desktop 的 devDependencies）"

Write-Host '== 装配应用目录（build\app）'
$appdir = "$installer\build\app"
Remove-Item -Recurse -Force $appdir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $appdir | Out-Null
Copy-Item "$installer\app-template\package.json", "$installer\app-template\bootstrap.mjs" $appdir
Copy-Item "$installer\app-template\lib" "$appdir\lib" -Recurse
# 渲染两处占位：version → 内核版（runtime.json 与产物名都报它）；__TGZ__ → tarball 相对
# 路径（appdir 在 build\app，tarball 在 build\ 根）。依赖必须声明进清单——electron-builder
# 按清单收集 node_modules，--no-save 装的包它不认，打出来的 asar 里没有内核（踩过）
$tgzRel = '../' + [System.IO.Path]::GetFileName($tgz)
(Get-Content "$appdir\package.json" -Raw) `
  -replace '"version": "0.0.0"', ('"version": "' + $kver + '"') `
  -replace '"file:__TGZ__"', ('"file:' + $tgzRel + '"') |
  Set-Content "$appdir\package.json"
Push-Location $appdir
npm install --no-fund --no-audit
Assert-LastExit '装配目录装内核 tarball'
if (-not (Test-Path "$appdir\node_modules\@godcreator\gwb-kernel-desktop")) {
  throw '装配目录里没有内核包——上一条 npm 八成没成，看输出'
}
Pop-Location

Write-Host '== 种子浮动解析（>= 下限现装取最新，不提交 lockfile——件集常规升版零提交）'
Push-Location "$installer\seed"
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
# 上一次留下的锁一并删：它不进 git，但留在盘上时 npm 照它装，>= 下限满足就不去拿新版
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install --no-fund --no-audit
Assert-LastExit '种子浮动解析'
if (-not (Test-Path "$installer\seed\node_modules\@godcreator\gwb-shell")) {
  throw '种子里没有 gwb-shell——解析没成，看输出'
}
Pop-Location
Write-Host '这次解析到：'
Push-Location "$installer\seed"
npm ls --depth=0
Pop-Location

Write-Host '== 种子 staging：垫高一层（electron-builder 的复制过滤硬排 from 根下的 node_modules）'
$stage = "$installer\build\stage"
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$stage\payload" | Out-Null
robocopy "$installer\seed" "$stage\payload" /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 种子失败（退出码 $LASTEXITCODE）" }
$LASTEXITCODE = 0

Write-Host '== electron-builder（electronVersion 现读现传）'
Push-Location $installer
if (-not (Test-Path "$installer\node_modules\electron-builder")) {
  npm install --no-fund --no-audit
  Assert-LastExit '装 electron-builder'
}
npx electron-builder --win --config.electronVersion=$ever
Assert-LastExit 'electron-builder'
Pop-Location

Write-Host '产物：'
Get-ChildItem "$installer\build\dist" -File |
  Where-Object { $_.Name -match '\.(exe|zip)$' } |
  ForEach-Object { Write-Host ("  {0}  {1:N1} MB" -f $_.Name, ($_.Length / 1MB)) }
