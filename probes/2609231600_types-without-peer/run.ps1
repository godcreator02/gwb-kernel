# 七个情形逐个跑：拷一份 ws/ 到工作目录、按情形改清单与 hoist、pnpm install、tsc、tsc --traceResolution，
# 摘录写进本目录 runs/<编号>-<名字>.txt（KB 量级）。node_modules、tgz、完整 trace 都只落工作目录，不进本目录。
# 前提：pwsh 7、node、pnpm、npm；@godcreator scope 在用户级 ~/.npmrc 指向 gitea 个人源，公共包走默认源。
param(
  [string] $Work = (Join-Path ([IO.Path]::GetTempPath()) ('gwbtp-' + (Get-Date -Format 'yyMMddHHmmss'))),
  [string[]] $Only = @()
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$runs = Join-Path $here 'runs'
New-Item -ItemType Directory -Force $Work, $runs | Out-Null
$Work = (Get-Item $Work).FullName   # 展开 8.3 短名，trace 里的路径才替换得掉

& (Join-Path $here 'prepare-vendor.ps1') -Work $Work

$nopeer = 'file:../../../vendor/bn-core-nopeer.tgz'
$optpeer = 'file:../../../vendor/bn-core-optpeer.tgz'
$apiNopeer = 'file:../../../vendor/plugin-api-nopeer.tgz'
$bn = '0.5.2'

# 每个情形：hoist（$null＝pnpm 默认）、consumer 的 devDependencies 改动、根 package.json 的 devDependencies
$scenarios = @(
  @{ Id = '01'; Name = 'hoist-default_consumer-3deps'; Hoist = $null; NoSkipLib = $true
     Say = '默认 hoist；bn-core 与 plugin-api 都去 peer；consumer 只列 bn-core / plugin-api / cordis（没列 block-note）'
     Consumer = @{} ; Root = @{} },
  @{ Id = '02'; Name = 'hoist-false_consumer-3deps'; Hoist = $false
     Say = 'hoist:false；其余同 01'
     Consumer = @{} ; Root = @{} },
  @{ Id = '03'; Name = 'hoist-false_consumer-4deps'; Hoist = $false
     Say = 'hoist:false；consumer 显式列齐 d.ts 类型面四包（再加 block-note）'
     Consumer = @{ '@godcreator/block-note' = $bn } ; Root = @{} },
  @{ Id = '04'; Name = 'hoist-default_consumer-4deps'; Hoist = $null
     Say = '默认 hoist；consumer 显式列齐四包'
     Consumer = @{ '@godcreator/block-note' = $bn } ; Root = @{} },
  @{ Id = '05'; Name = 'hoist-false_root-lists'; Hoist = $false
     Say = 'hoist:false；consumer 列齐四包，另在工作区根 package.json 列 plugin-api / block-note / cordis'
     Consumer = @{ '@godcreator/block-note' = $bn }
     Root = @{ '@godcreator/gwb-plugin-api' = 'file:../vendor/plugin-api-nopeer.tgz'; '@godcreator/block-note' = $bn; 'cordis' = '4.0.0-rc.9' } },
  @{ Id = '06'; Name = 'hoist-false_bncore-optpeer_api-nopeer'; Hoist = $false
     Say = 'hoist:false；bn-core 把类型面三包写成可选 peer；plugin-api 仍去 peer；consumer 列齐四包'
     Consumer = @{ '@godcreator/block-note' = $bn; '@godcreator/gwb-bn-core' = $optpeer } ; Root = @{} },
  @{ Id = '07'; Name = 'hoist-false_bncore-optpeer_api-registry'; Hoist = $false
     Say = 'hoist:false；bn-core 可选 peer；plugin-api 用 registry 原包（peer cordis 保留）；consumer 列齐四包'
     Consumer = @{ '@godcreator/block-note' = $bn; '@godcreator/gwb-bn-core' = $optpeer; '@godcreator/gwb-plugin-api' = '0.2.7' } ; Root = @{} }
)

# probe.ts 行号 → 标签（改 probe.ts 要同步这张表）
$labels = @(
  @(8, 'E1 dataDir 当 number'), @(10, 'E2 ctx.blockNote 增强'), @(12, 'E3 不存在的名字'),
  @(14, '(E4 前置) ctx.blockNoteLibraries 增强'), @(15, 'E4 register 传错参数'), @(17, 'E5 BlockNoteMark.contract'),
  @(19, 'OK ctx.effect（不该报）')
)
$watch = '^(cordis|@godcreator/gwb-plugin-api|@godcreator/block-note)$'

function Get-ResolutionDigest([string[]] $trace, [string] $work) {
  $w = $work.Replace('\', '/')
  $out = [System.Collections.Generic.List[string]]::new()
  $mod = $null; $from = $null; $via = $null
  foreach ($line in $trace) {
    if ($line -match "^======== Resolving module '([^']+)' from '([^']+)'") {
      $mod = $Matches[1]; $from = $Matches[2]; $via = $null; continue
    }
    if ($null -eq $mod -or $mod -notmatch $watch) { continue }
    if ($null -eq $via -and $line -match "'([^']*/node_modules/$([regex]::Escape($mod)))/package\.json'( exists|\.)") { $via = $Matches[1] }
    if ($line -match "^======== Module name '[^']+' was (successfully resolved to '([^']+)'|not resolved)") {
      $res = if ($Matches[2]) { $Matches[2] } else { '<<NOT RESOLVED>>' }
      $f = $from.Replace($w, '<W>'); $r = $res.Replace($w, '<W>'); $v = if ($via) { $via.Replace($w, '<W>') } else { '-' }
      $rec = "[$mod]`n    from: $f`n    via : $v`n    to  : $r"
      if (-not $out.Contains($rec)) { $out.Add($rec) }
      $mod = $null
    }
  }
  $out
}

Set-Location $Work   # pnpm 会读 cwd 往上的清单；从哪个仓里调起都别让它碰那个仓
$pnpmV = (pnpm -v).Trim()
foreach ($s in $scenarios) {
  if ($Only.Count -gt 0 -and $Only -notcontains $s.Id) { continue }
  # 工作目录里只用编号：长名字加 .pnpm 深路径会越过 Windows 260 字符，node 读不到 typescript 的 package.json（撞过）
  $dir = Join-Path $Work "s$($s.Id)"
  Copy-Item -Recurse (Join-Path $here 'ws') $dir

  $cPath = Join-Path $dir 'plugins\consumer\package.json'
  $c = Get-Content $cPath -Raw | ConvertFrom-Json -AsHashtable
  foreach ($k in $s.Consumer.Keys) { $c['devDependencies'][$k] = $s.Consumer[$k] }
  $c | ConvertTo-Json -Depth 10 | Set-Content $cPath
  $rPath = Join-Path $dir 'package.json'
  $r = Get-Content $rPath -Raw | ConvertFrom-Json -AsHashtable
  if ($s.Root.Count -gt 0) { $r['devDependencies'] = [ordered]@{}; foreach ($k in $s.Root.Keys) { $r['devDependencies'][$k] = $s.Root[$k] } }
  $r | ConvertTo-Json -Depth 10 | Set-Content $rPath
  if ($s.Hoist -eq $false) { Add-Content (Join-Path $dir 'pnpm-workspace.yaml') 'hoist: false' }

  Push-Location $dir
  $install = pnpm install 2>&1 | Select-Object -Last 1
  Pop-Location
  $hidden = Join-Path $dir 'node_modules\.pnpm\node_modules'
  $hid = 'cordis={0} plugin-api={1} block-note={2}' -f (Test-Path "$hidden\cordis"), (Test-Path "$hidden\@godcreator\gwb-plugin-api"), (Test-Path "$hidden\@godcreator\block-note")

  $consumer = Join-Path $dir 'plugins\consumer'
  Push-Location $consumer
  $tscV = (pnpm exec tsc -v).Trim()
  $tsc = @(pnpm exec tsc -p . 2>&1 | ForEach-Object { "$_" })
  $noSkip = if ($s.NoSkipLib) { @(pnpm exec tsc -p . --skipLibCheck false 2>&1 | ForEach-Object { "$_".Replace($Work.Replace('\', '/'), '<W>') }) } else { $null }
  $tracePath = Join-Path $dir 'trace.txt'
  pnpm exec tsc -p . --traceResolution 2>&1 | ForEach-Object { "$_" } | Set-Content $tracePath
  Pop-Location

  $hits = @{}
  foreach ($t in $tsc) { if ($t -match '^src/probe\.ts\((\d+),\d+\): error (TS\d+)') { $hits[[int]$Matches[1]] = $Matches[2] } }
  $table = foreach ($pair in $labels) {
    $ln = $pair[0]
    $state = if ($hits.ContainsKey($ln)) { "报 $($hits[$ln])" } elseif ($ln -eq 19) { '不报（正确）' } elseif ($ln -eq 14) { '不报' } else { '不报 → 这段类型静默成了 any' }
    '  L{0,-3} {1,-34} {2}' -f $ln, $pair[1], $state
  }

  $body = @(
    "# $($s.Id) $($s.Name)"
    "情形：$($s.Say)"
    "跑于 $(Get-Date -Format 'yyyy-MM-dd HH:mm')；node $(node -v)；pnpm $pnpmV；tsc $($tscV -replace '^Version ', '')；工作目录记作 <W>"
    ''
    '--- 本情形的清单'
    "pnpm-workspace hoist: $(if ($s.Hoist -eq $false) { 'false' } else { '默认' })"
    "root devDependencies: $(if ($r['devDependencies']) { $r['devDependencies'] | ConvertTo-Json -Compress } else { '（无）' })"
    "consumer devDependencies: $($c['devDependencies'] | ConvertTo-Json -Compress)"
    "pnpm install: $install"
    "隐藏提升目录 node_modules/.pnpm/node_modules 里有没有：$hid"
    ''
    '--- tsc -p .（skipLibCheck:true，照 gwb 各仓现行配置）'
    $(if ($tsc.Count -eq 0) { '（无输出）' } else { $tsc })
    ''
    '--- 对照 probe.ts 的探测点'
    $table
  )
  if ($noSkip) { $body += @('', '--- 追加：tsc -p . --skipLibCheck false（看 d.ts 里的解析失败会不会露出来）', $noSkip) }
  $body += @('', '--- traceResolution 摘录：cordis / plugin-api / block-note（from＝谁发起，via＝在哪层 node_modules 找到，to＝最终落点）')
  $body += Get-ResolutionDigest (Get-Content $tracePath) $Work

  $outFile = Join-Path $runs "$($s.Id)-$($s.Name).txt"
  $body | Set-Content -Encoding utf8 $outFile
  "{0} {1}  → {2}" -f $s.Id, $s.Name, (($tsc | Where-Object { $_ -match 'error TS' }).Count)
}
"工作目录（node_modules、tgz、完整 trace）：$Work —— 用完可整个删掉"
exit 0   # tsc 报错是预期读数，不是脚本失败
