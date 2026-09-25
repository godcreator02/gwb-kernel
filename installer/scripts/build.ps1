# 打安装包。每一步做什么、哪几道检查不能删、打完怎么验证，见文档站
$ErrorActionPreference = 'Stop'
$installer = Split-Path $PSScriptRoot -Parent
$KernelDir = Split-Path $installer -Parent
$launcherDir = "$KernelDir\apps\launcher"

# 国内网络下载 electron-builder 的二进制要走镜像
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'

# pwsh 遇到原生命令的非零退出码默认不停，每条 npm / pnpm 之后都要调用它
function Assert-LastExit([string]$what, [int]$ok = 0) {
  if ($LASTEXITCODE -ne $ok) { throw "$what 失败（退出码 $LASTEXITCODE）" }
}

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
# 依赖必须写进清单：electron-builder 按清单收集 node_modules，--no-save 装的包它不收
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
  Where-Object { $_.Name -match '\.exe$' } |
  ForEach-Object { Write-Host ("  {0}  {1:N1} MB" -f $_.Name, ($_.Length / 1MB)) }
