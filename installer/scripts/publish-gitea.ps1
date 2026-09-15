# 把 build\dist\ 里的安装器产物传到 gitea 的 draft release。要 GITEA_TOKEN（api 权限）；
# 仓得先在 gitea 上建好（owner/repo 参数可改）。传完去网页确认再发布
param(
  [string]$Owner = 'godcreator',
  [string]$Repo = 'gwb-kernel',
  [string]$Tag,
  [string[]]$Files
)
$ErrorActionPreference = 'Stop'

if (-not $env:GITEA_TOKEN) { throw '先设 $env:GITEA_TOKEN（gitea 上开的 api token）' }
$installer = Split-Path $PSScriptRoot -Parent
$kernel = Split-Path $installer -Parent
if (-not $Tag) {
  $Tag = 'v' + (Get-Content (Join-Path $kernel 'apps\desktop\package.json') | ConvertFrom-Json).version
}
if (-not $Files) {
  $Files = @(Get-ChildItem (Join-Path $installer 'build\dist') -File |
    Where-Object { $_.Name -match '\.(exe|zip)$' } |
    ForEach-Object { $_.FullName })
}

$base = 'https://git.tianshen02.online:28377/api/v1'
$headers = @{ Authorization = "token $env:GITEA_TOKEN" }

$body = @{ tag_name = $Tag; name = "gwb $Tag"; draft = $true; prerelease = $false } | ConvertTo-Json
$release = Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "$base/repos/$Owner/$Repo/releases" -ContentType 'application/json' -Body $body

foreach ($file in $Files) {
  $name = [System.IO.Path]::GetFileName($file)
  Invoke-RestMethod -Method Post -Headers $headers `
    -Uri "$base/repos/$Owner/$Repo/releases/$($release.id)/assets?name=$name" `
    -Form @{ attachment = Get-Item $file } | Out-Null
  Write-Host "传上 $name"
}
Write-Host "draft release $Tag 共 $($Files.Count) 个产物，去 gitea 网页确认后发布"
