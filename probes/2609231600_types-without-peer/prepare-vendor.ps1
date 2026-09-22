# 从 registry 拉 bn-core / plugin-api 的发布包，改掉清单里的 peer，重打成三份 tgz 放进 <Work>\vendor：
#   bn-core-nopeer.tgz     peerDependencies 整份挪进 devDependencies（依赖方的 devDependencies 不会被装＝模拟「没有 peer」）
#   bn-core-optpeer.tgz    peer 只留类型面引用的三个包（block-note / plugin-api / cordis），全标 peerDependenciesMeta.optional
#   plugin-api-nopeer.tgz  plugin-api 自己的 peer（cordis）同样挪进 devDependencies
# 大文件（原包、解开的目录、tgz）一律落 <Work>，不进探针目录。
param(
  [Parameter(Mandatory)] [string] $Work,
  [string] $BnCoreVersion = '0.18.5',
  [string] $PluginApiVersion = '0.2.7'
)
$ErrorActionPreference = 'Stop'

$pack = Join-Path $Work 'pack'
$vendor = Join-Path $Work 'vendor'
New-Item -ItemType Directory -Force $pack, $vendor | Out-Null

function Get-Unpacked([string] $spec, [string] $dirName) {
  Push-Location $pack
  try {
    $tgz = (npm pack $spec --silent 2>$null | Select-Object -Last 1).Trim()
    $dest = Join-Path $pack $dirName
    New-Item -ItemType Directory -Force $dest | Out-Null
    tar -xzf $tgz -C $dest
    return (Join-Path $dest 'package')
  } finally { Pop-Location }
}

function Save-Repacked([string] $pkgDir, [hashtable] $manifest, [string] $outName) {
  $manifest | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $pkgDir 'package.json')
  Push-Location $pkgDir
  try {
    $tgz = (npm pack --ignore-scripts --silent --pack-destination $vendor 2>$null | Select-Object -Last 1).Trim()
    Move-Item -Force (Join-Path $vendor $tgz) (Join-Path $vendor $outName)
  } finally { Pop-Location }
}

function Read-Manifest([string] $pkgDir) { Get-Content (Join-Path $pkgDir 'package.json') -Raw | ConvertFrom-Json -AsHashtable }

# bn-core：去 peer
$dir = Get-Unpacked "@godcreator/gwb-bn-core@$BnCoreVersion" 'bn-core-nopeer'
$m = Read-Manifest $dir
$m['devDependencies'] = $m['peerDependencies']; $m.Remove('peerDependencies')
Save-Repacked $dir $m 'bn-core-nopeer.tgz'

# bn-core：类型面三包写成可选 peer
$dir = Get-Unpacked "@godcreator/gwb-bn-core@$BnCoreVersion" 'bn-core-optpeer'
$m = Read-Manifest $dir
$m['peerDependencies'] = [ordered]@{ '@godcreator/block-note' = '^0.5.2'; '@godcreator/gwb-plugin-api' = '^0.2.7'; 'cordis' = '^4.0.0-rc.9' }
$m['peerDependenciesMeta'] = [ordered]@{ '@godcreator/block-note' = @{ optional = $true }; '@godcreator/gwb-plugin-api' = @{ optional = $true }; 'cordis' = @{ optional = $true } }
Save-Repacked $dir $m 'bn-core-optpeer.tgz'

# plugin-api：去 peer
$dir = Get-Unpacked "@godcreator/gwb-plugin-api@$PluginApiVersion" 'plugin-api-nopeer'
$m = Read-Manifest $dir
$m['devDependencies'] = $m['peerDependencies']; $m.Remove('peerDependencies')
Save-Repacked $dir $m 'plugin-api-nopeer.tgz'

Get-ChildItem $vendor | ForEach-Object { '{0,9}  {1}' -f $_.Length, $_.Name }
