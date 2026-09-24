# 生成安装包的全流程：检查工作区没有未提交的改动 → 构建启动器 → 组装应用目录 → electron-builder 生成
# NSIS 安装包与便携 zip。产物在 build\dist\。安装包只带启动器与 Electron：内核和插件都装在 home 里，
# 由创建 home 的一方照仓根 INSTALL.md 装（打包步骤与验证见文档站的「开发」页）
param([string]$KernelDir = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent))

$ErrorActionPreference = 'Stop'
$installer = Split-Path $PSScriptRoot -Parent
$launcherDir = "$KernelDir\apps\launcher"

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

Write-Host '== 构建启动器'
Push-Location $launcherDir
pnpm build
Assert-LastExit '构建启动器'
Pop-Location

$launcher = Get-Content "$launcherDir\package.json" -Raw | ConvertFrom-Json
$electronVersion = $launcher.devDependencies.electron
Write-Host "启动器 $($launcher.version) / electron $electronVersion（安装包的版本号就是启动器的版本号；electron 的版本只写在 apps\launcher 的 devDependencies 里）"

Write-Host '== 组装应用目录（build\app）'
$appdir = "$installer\build\app"
Remove-Item -Recurse -Force $appdir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $appdir | Out-Null
Copy-Item "$launcherDir\dist\*.js" $appdir
# 清单只留运行要的字段；依赖必须写进清单——electron-builder 按清单收集 node_modules，
# --no-save 装的包它不收（出过打出来的 asar 里缺包的问题）
[ordered]@{
  name         = 'gwb-kernel'
  productName  = $launcher.productName
  version      = $launcher.version
  private      = $true
  description  = $launcher.description
  author       = $launcher.author
  type         = 'module'
  main         = 'main.js'
  dependencies = $launcher.dependencies
} | ConvertTo-Json -Depth 5 | Set-Content "$appdir\package.json"
Push-Location $appdir
npm install --no-fund --no-audit
Assert-LastExit '组装目录安装启动器的依赖'
Pop-Location

Write-Host '== electron-builder（electronVersion 从 apps\launcher 读出后传入）'
Push-Location $installer
if (-not (Test-Path "$installer\node_modules\electron-builder")) {
  npm install --no-fund --no-audit
  Assert-LastExit '安装 electron-builder'
}
npx electron-builder --win --config.electronVersion=$electronVersion
Assert-LastExit 'electron-builder'
Pop-Location

Write-Host '产物：'
Get-ChildItem "$installer\build\dist" -File |
  Where-Object { $_.Name -match '\.(exe|zip)$' } |
  ForEach-Object { Write-Host ("  {0}  {1:N1} MB" -f $_.Name, ($_.Length / 1MB)) }
