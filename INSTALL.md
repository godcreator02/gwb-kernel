# 安装 gwb（写给 agent）

你是替用户在一台 Windows 机器上安装 gwb 的 agent。**安装包只带启动器与 Electron，不带内核、不带插件，也不带 pnpm——内核包、`cordis` 与插件都由你用机器上装好的 pnpm 12（第 1 步）装进 home。** 启动器启动时从 home 里加载内核，home 里没有内核包就弹框说明、不启动。
照下面做完，用户得到一个装好第 3 步那些基础插件（包括命令插件、插件管理、MCP 入口）、MCP 入口开在 `http://127.0.0.1:2870/mcp` 的工作台，
之后你（或别的 agent）通过这个 MCP 入口使用工作台。命令一律在 PowerShell 里运行。用户还要写自己的插件时，装完再照最后一节「开发插件」补齐开发要用的几样。

## 0. 先确认装没装过

`%APPDATA%\gwb-kernel\homes\default\cordis.yml` 已经存在、里面至少有一行 `- id:`——**已经装过，只升级，
别做第 3 步**（它会覆盖用户的 home）。`homes\` 下的其他目录是别的 home（测试用的），跟这个判断无关：

- 升级内核：连上 MCP 入口之后 `run plugin-manager.update {"specs":{"@godcreator/gwb-kernel-desktop":"<版本>"}}`（`<版本>` 写 `latest` 就是最新版；
  插件管理装上新的内核包，再把 home 根上的 `cordis` 对齐到内核要的版本，`specs` 里不写 `cordis`），回执 `restartRequired` 为 `true` 时
  重启工作台（关掉窗口、从开始菜单重新打开）才生效。安装包只带启动器，只有出了新版安装包才需要重装
- 升级插件：连上 MCP 入口之后 `run plugin-manager.update {"all":true}`（只升几个给 `{"only":["<包名>"]}`），成功后 `run shell.reload`
  整页重新加载，页面上才用上新版本；或让用户在「插件管理」窗格点「全部更新」。`all` 与 `only` 不升内核包与 `cordis`

## 1. 机器上的前置条件（改的是用户级配置——动手前告诉用户要改什么）

1. **pnpm 12（不低于 12.4.2），装在两个固定位置之一**：插件管理与 devkit 只按顺序检查这两个位置、用第一个存在的，
   不找 PATH、不读设置：`%LOCALAPPDATA%\pnpm\bin\pnpm.exe`（pnpm 官方安装脚本的默认位置）、
   `%APPDATA%\npm\node_modules\pnpm\pnpm.exe`（`npm i -g pnpm` 装的 pnpm 包里的原生可执行文件）。这一步、第 3 步和之后
   插件管理用的都是同一个。先看有没有：

   ```powershell
   $pnpm = @("$env:LOCALAPPDATA\pnpm\bin\pnpm.exe", "$env:APPDATA\npm\node_modules\pnpm\pnpm.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
   if ($pnpm) { "$pnpm $(& $pnpm --version)" } else { '两个位置都没有 pnpm' }
   ```

   输出的版本是 12.x 并且不低于 12.4.2 就是配好了。两个位置都没有、或版本不对：先征得用户同意，再用 pnpm 官方安装脚本装
   `$env:PNPM_VERSION='12.4.2'; iwr https://get.pnpm.io/install.ps1 -useb | iex`（它会改用户级环境变量：写入 `PNPM_HOME`、
   把 `%LOCALAPPDATA%\pnpm\bin` 加进 PATH），机器上有 node 的话也可以 `npm i -g pnpm@12.4.2`。装完重新运行上面两行确认。
   用 corepack、volta 装的，或设过 `PNPM_HOME`、改过 npm 全局目录的 pnpm，不在这两个位置，插件管理找不到
2. **`@godcreator` 的包从哪里下载**：`& $pnpm config get @godcreator:registry` 输出下面这个地址就是配好了。
   没有就往用户级 `%USERPROFILE%\.npmrc` 追加这一行（其他行一律不动，已有的 token 行保留）：

   ```
   @godcreator:registry=https://git.tianshen02.online:28377/api/packages/godcreator/npm/
   ```

   只读安装不需要 token。少了这一行，pnpm 会去 npmjs 找这些包，报 404。**别把 `.npmrc` 全文打印出来**
   ——里面可能有用户的发布 token。
3. **放行刚发布的包**：pnpm 11 起，发布不满一天的包默认不允许安装，而 gwb 的插件常常当天发布。
   `& $pnpm config get minimumReleaseAgeExclude` 的输出里有 `@godcreator/*` 就是配好了。没有：
   `& $pnpm config get globalconfig` 会输出一个 yaml 文件的路径（通常是 `%LOCALAPPDATA%\pnpm\config\config.yaml`），
   在里面加上（已有这个键就把这一项合并进列表）：

   ```yaml
   minimumReleaseAgeExclude:
     - '@godcreator/*'
   ```

   只放行这一个 scope，其他包仍受这条规则保护。
4. **可选**：连 npmjs 慢的话，第三方包改走镜像：`& $pnpm config set registry https://registry.npmmirror.com`
   （`@godcreator` 仍按第 2 条走自己的源）。这也是用户级配置，先问用户。

## 2. 安装启动器

从 `https://git.tianshen02.online:28377/godcreator/gwb-kernel/releases` 下载最新的
`gwb-setup-<版>.exe`（下载之前告诉用户文件名与大小），静默安装。文件名、大小与下载地址不开浏览器也拿得到：

```powershell
(Invoke-RestMethod https://git.tianshen02.online:28377/api/v1/repos/godcreator/gwb-kernel/releases/latest).assets |
  Select-Object name, size, browser_download_url
```

```powershell
Start-Process .\gwb-setup-<版>.exe -ArgumentList '/S' -Wait
```

安装到 `%LOCALAPPDATA%\Programs\gwb-kernel\`，按当前用户安装、不需要管理员权限，开始菜单会出现「gwb-kernel」。
装的是哪一版启动器：`(Get-Item "$env:LOCALAPPDATA\Programs\gwb-kernel\gwb-kernel.exe").VersionInfo.ProductVersion`，和发布页的版本号比。
**先别启动**——第 3 步要在它启动之前把 home 初始化好；已经启动了就先关掉窗口。

这时候启动（开始菜单或双击 exe）看到的是：不开窗口，只弹一个错误框，说 home 里没有内核包 `@godcreator/gwb-kernel-desktop`、照 `INSTALL.md` 装；
点确定后进程以退出码 1 结束，home 里不写任何文件。这是正常的，照第 3 步装好再启动。

## 3. 初始化 default home

注意 PowerShell 里 `$home` 是保留变量，别拿它当变量名。`$pnpm` 是第 1 步第 1 条找到的那个 pnpm，这里再取一次。
先设 `pnpm_config_auto_install_peers=false`：插件的 peer 里写着它用到的别的插件，pnpm 默认会把 home 里没装的 peer 自动装进来，
成了没有条目、插件管理也不认的包；插件管理与 devkit 运行 pnpm 时也都带着这个设置。

```powershell
$env:pnpm_config_auto_install_peers = 'false'
$pnpm = @("$env:LOCALAPPDATA\pnpm\bin\pnpm.exe", "$env:APPDATA\npm\node_modules\pnpm\pnpm.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$gwbHome = "$env:APPDATA\gwb-kernel\homes\default"
New-Item -ItemType Directory -Force $gwbHome | Out-Null
[IO.File]::WriteAllText("$gwbHome\package.json", '{ "name": "gwb-home", "private": true }')
Set-Location $gwbHome

# 装内核包与 cordis：内核包照 pnpm 默认写 ^ 范围；cordis 写精确版本号，就是内核包 peer 里写的那个
$kernel = & $pnpm view @godcreator/gwb-kernel-desktop dist-tags.latest
& $pnpm add "@godcreator/gwb-kernel-desktop@$kernel"
$cordis = (Get-Content node_modules\@godcreator\gwb-kernel-desktop\package.json -Raw | ConvertFrom-Json).peerDependencies.cordis
& $pnpm add --save-exact "cordis@$cordis"   # pnpm 装内核包时多半已按 peer 装好 cordis，会说 Already up to date；这一条是把它按精确版本号写进清单
[IO.File]::WriteAllText("$gwbHome\cordis.yml", @'
- id: commands
  name: '@godcreator/gwb-commands'
- id: data
  name: '@godcreator/gwb-data'
- id: settings
  name: '@godcreator/gwb-settings'
- id: skills
  name: '@godcreator/gwb-skills'
- id: plugin-manager
  name: '@godcreator/gwb-plugin-manager'
- id: shell
  name: '@godcreator/gwb-shell'
- id: baseui
  name: '@godcreator/gwb-baseui'
- id: node-cli
  name: '@godcreator/gwb-node-cli'
- id: devkit
  name: '@godcreator/gwb-devkit'
- id: mcp
  name: '@godcreator/gwb-mcp'
'@)
& $pnpm add @godcreator/gwb-commands @godcreator/gwb-data @godcreator/gwb-settings @godcreator/gwb-skills @godcreator/gwb-plugin-manager @godcreator/gwb-shell @godcreator/gwb-baseui @godcreator/gwb-node-cli @godcreator/gwb-devkit @godcreator/gwb-mcp
```

- 内核包与 `cordis` 装完读回核对：`node_modules\@godcreator\gwb-kernel-desktop\package.json` 的 `version` 等于 `$kernel`，
  `node_modules\cordis\package.json` 的 `version` 等于 `$cordis`。对不上就把 home 的 `package.json` 里那一项改成精确版本号再运行一次
  （清单里原来写着 `^` 范围时，pnpm 会沿用范围、装上别的版本）。内核与所有插件用的是 home 根上这一份 `cordis`
- `cordis.yml` 是条目表：一行一个插件，`id` 必须手写（不写的话每次启动都会换一个随机字符串）；内核包与 `cordis` 不是插件，不写进去
- 命令插件（`gwb-commands`，页面和 MCP 入口的命令都经它执行）与插件管理（`gwb-plugin-manager`，之后装卸、升级插件都经它）是普通插件，和别的插件一样写进 `cordis.yml`、装进 home
- 除了内核包与 `cordis`，只装插件、不装库：页面用的 React 随 shell 插件装上，
  设计令牌表随 `gwb-shell` 装上
- 退出码为 0 就成功。输出里如果有一行 `Issues with peer dependencies found`：说明有插件的 peer 没满足——它用到的某个插件没装，
  或装的版本不在它写的范围里（还没适配上游的新版本）。包照样装上了，但那个插件可能启动不了——在 home 里运行 `& $pnpm peers check`
  拿到明细，原样告诉用户；连上 MCP 入口之后 `plugin-manager.list` 的 `unmetPeers` 也逐包列出

## 4. 启动、核对

**只看 `runtime.json` 有没有 `mcp` 字段不能证明这次启动成功**：程序退出后这个文件照样留着，上一次运行写的 `mcp` 也还在。
这次启动写的 `runtime.json` 要同时满足三条：`startedAt`（毫秒时间戳）晚于你启动的时刻、`pid` 是一个活着的进程、有 `mcp` 字段。
所以先记下时刻再启动，轮询到三条都满足：

```powershell
$rt = "$env:APPDATA\gwb-kernel\homes\default\runtime.json"
$launchedAt = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
Start-Process "$env:LOCALAPPDATA\Programs\gwb-kernel\gwb-kernel.exe"
$runtime = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep 1
  if (-not (Test-Path $rt)) { continue }
  $candidate = Get-Content $rt -Raw | ConvertFrom-Json
  if ($candidate.startedAt -ge $launchedAt -and $candidate.mcp -and (Get-Process -Id $candidate.pid -ErrorAction SilentlyContinue)) { $runtime = $candidate; break }
}
if ($runtime) { $runtime } else { '30 秒内没等到这次启动写的 runtime.json：看 gwb.log 的最后几行' }
```

几秒内就绪。30 秒没等到：`gwb.log` 最后有 `已有实例在运行，本实例退出`，说明这个 home 已经有一个在运行（同一个 home 只能运行一个实例）；
别的情况照下面「常见问题」查。**三条满足也只说明进程在运行、MCP 插件写了地址；以第 5 步用这个地址调通 `index` 为准**，那一步通了才算启动成功。

- `runtime.json` 里有 `version`（内核版本）与 `"mcp": { "url": "http://127.0.0.1:2870/mcp" }`——MCP 入口的地址
  **以这个字段为准**
- 同目录的 `gwb.log` 一行一个 JSON 对象，键是 `ts`、`level`、`source`、`name`、`msg`。应该有 `name` 为 `kernel`、`msg` 以 `up` 开头的一行，
  与 `name` 为 `gwb-mcp`、`msg` 为 `MCP 入口已就绪` 的一行；
  `Get-Content "$env:APPDATA\gwb-kernel\homes\default\gwb.log" | ConvertFrom-Json | Where-Object level -eq 'error'` 应当没有任何输出
  （`level` 为 `warn` 的行读一读，不算失败）。`gwb.log` 超过 128 MB 会改名成 `gwb.log.1` 另起一份，找不到早先的行就去 `.1` 里找

能看到窗口的话，窗口里应该是：

- **装好了**：工作台界面，底部状态栏右边写着 `gwb-kernel <版>`，这个版本号就是 `runtime.json` 里的 `version`（鼠标停在上面会列出外壳等其余版本）
- **内核已启动、外壳没有加载**：深色底上一页只读的等宽文字，第一行是「没有外壳插件（没有插件调用 setShell）。」或「外壳启动失败：…」，
  下面是 home 的路径、`cordis.yml` 里每个条目的 id、包名与状态，以及最近的错误与警告。照「常见问题」里「窗口里只有只读状态页」那一行查

## 5. 连接 MCP 入口

MCP 入口的地址在 `runtime.json` 的 `mcp.url`（default 就是 `http://127.0.0.1:2870/mcp`），只绑定本机，**要求
`Authorization: Bearer <token>`**：token 每个 home 一份，存在 `<home>\mcp\secret.json`（字段 `token`），重启不变；
没带或对不上一律返回 401。

先不改任何客户端配置，用 MCP 入口自带的命令行客户端验证一遍（零依赖；不给 token 时它读 default home 的凭据文件）。
它装在第 3 步的 home 里（第 3 步没装成就没有它），要 Node 18 起才能运行。**机器上没有 `node` 命令也能跑**（比如 pnpm 是用官方安装脚本装的独立版本）：
安装包带的 Electron 设了环境变量 `ELECTRON_RUN_AS_NODE=1` 就是一个 Node（版本见状态栏悬停提示里的 Node 那一项）。下面先定义一个 `gwbClient`，两种情况都用它：

```powershell
$gwbHome = "$env:APPDATA\gwb-kernel\homes\default"
$client = "$gwbHome\node_modules\@godcreator\gwb-mcp\bin\client.mjs"
$url = (Get-Content "$gwbHome\runtime.json" -Raw | ConvertFrom-Json).mcp.url
if (Get-Command node -ErrorAction SilentlyContinue) {
  function gwbClient { node $client --url $url @args }
} else {
  # gwb-kernel.exe 是窗口程序：直接调用时 PowerShell 不等它结束、也收不到输出，所以经 Start-Process 等它结束、输出写进临时文件
  function gwbClient {
    $outFile = New-TemporaryFile
    $env:ELECTRON_RUN_AS_NODE = '1'
    try {
      $process = Start-Process "$env:LOCALAPPDATA\Programs\gwb-kernel\gwb-kernel.exe" -ArgumentList (@("`"$client`"", '--url', $url) + $args) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outFile
    } finally {
      Remove-Item Env:ELECTRON_RUN_AS_NODE
    }
    Get-Content $outFile -Raw
    Remove-Item $outFile
    if ($process.ExitCode -ne 0) { throw "client.mjs 退出码 $($process.ExitCode)" }
  }
}
gwbClient index
gwbClient run plugin-manager.list
gwbClient run skill.list
```

`ELECTRON_RUN_AS_NODE` 只在调用客户端的那一刻设上、用完就删：它留在环境里的话，之后再从这个 PowerShell 用 `Start-Process` 启动工作台，exe 会当成 Node 运行，工作台不会启动。

**`index` 调通才算第 4 步的启动成功**：回执开头的 `home` 是这个 home 的名字（default 就是 `default`），`version` 是 MCP 插件的版本。
连不上、401、或 `home` 不是你启动的那个，都不算成功。

MCP 入口能连通，再给用户常用的客户端配置上。先拿到已带请求头的配置片段：`gwbClient run mcp.token`
返回 `{ token, file, mcpServers }`，`mcpServers` 里已带 `headers`，原样复制就能连上（**返回内容含明文凭据**，别贴到
公开的地方）：

- Claude Code：`claude mcp add --transport http gwb http://127.0.0.1:2870/mcp --header "Authorization: Bearer <token>"`
  （要所有项目都能用就加 `--scope user`），然后开新会话，或在会话里 `/mcp` 重连
- 其他客户端：原样复制上面 `mcpServers` 那一段（形状是 `{ "gwb": { "type": "http", "url": …, "headers": { "Authorization": "Bearer <token>" } } }`）

连上后**先调 `index`**：它返回的 instructions 讲清楚之后怎么使用工作台。再核对：

- `run plugin-manager.list` 返回第 3 步 `cordis.yml` 里的每个插件，各带一个条目、`active: true`；内核包与 `cordis` 不是插件，不在里面。
  插件的 `kernelUntested` 为 `true` 只是报告：它的 peer 里没写内核包，或写的范围不包含运行中的内核，照常加载，不算失败
- `run skill.list` 能列出说明书，至少有 `mcp`、`gwb-commands`、`gwb-plugin-manager`、`gwb-devkit`
- `run plugin-manager.search` 能列出源上可装的插件——「插件管理」窗格的「可装」栏用的就是它

做完，把第 1 步改过的配置告诉用户。

## 装一个别的 home（测试用）

同一台机器上可以有多个 home，各自一个目录、各自一套插件，可以同时运行（同一个 home 只能运行一个实例）。照上面装别的 home 时：

- 把第 3 步起的 `$gwbHome` 换成那个目录；启动前设 `GWB_HOME`：写名字就是 `%APPDATA%\gwb-kernel\homes\<名字>`，写带路径分隔符的就是那个目录本身。
  例：`$env:GWB_HOME = $gwbHome; Start-Process "$env:LOCALAPPDATA\Programs\gwb-kernel\gwb-kernel.exe"`
- MCP 入口的端口不是 2870，一律从那个 home 的 `runtime.json` 的 `mcp.url` 取
- 命令行客户端要显式给那个 home 的 token：`gwbClient --token (Get-Content "$gwbHome\mcp\secret.json" -Raw | ConvertFrom-Json).token index`（`$url` 先换成那个 home 的）
  （也可以设环境变量 `GWB_MCP_TOKEN`）。不给的话它用 default home 的 token，会 401

## 常见问题

| 现象 | 多半是 | 怎么办 |
| --- | --- | --- |
| `pnpm add` 报 404，找不到 `@godcreator/…` | 第 1 步第 2 条那行没配 | 补上再装 |
| 启动时弹框说 home 里没有内核包 | 第 3 步的内核包没装，或装在了别的 home | 照第 3 步在这个 home 里装内核包与 `cordis` 再启动 |
| 启动时弹框说 Electron 版本不满足内核包要求 | 安装包太旧，内核包要的 Electron 更新 | 装最新的安装包 |
| 装完提示 `Issues with peer dependencies found` | 有插件没适配上游的新版本 | `& $pnpm peers check` 看明细告诉用户 |
| 报版本太新、minimum release age | 第 1 步第 3 条没配 | 补上再装 |
| 第 1 步找不到 pnpm，或版本不是 12.x、低于 12.4.2 | pnpm 没装、装在别处，或版本不对 | 照第 1 步第 1 条装到两个固定位置之一 |
| 连 npmjs 超时 | 网络 | 按第 1 步第 4 条换镜像 |
| 窗口里只有只读状态页、没有状态栏 | 外壳没加载成功 | 看 `gwb.log` 里的 `error` 行，多半是第 3 步没装成功 |
| 页面上的命令都回「没有命令服务」 | 命令插件没加载成功 | 看 `cordis.yml` 里有没有 `commands` 那条、home 里装没装 `@godcreator/gwb-commands` |
| MCP 入口连不上 | 工作台没启动，或 2870 端口被占用（default 的 MCP 入口不换端口） | 看 `runtime.json` 有没有 `mcp`；在 `gwb.log` 里找 `gwb-mcp` 那行；关掉占用 2870 端口的程序再启动 |
| 「插件管理」里安装插件失败，回执说找不到 pnpm 或版本不对 | 两个固定位置都没有 pnpm，或找到的不是 12.x、低于 12.4.2 | 照第 1 步第 1 条装好，回执里写着检查了哪两个位置 |

## 之后

- 找可装的插件：`run plugin-manager.search`；装别的包名范围（比如 `@j`）的插件，先往 `~/.npmrc` 加那个范围的包源行，
  写法见说明书 `gwb-plugin-manager` 的「配第三方包源」（`run skill.read {"name":"gwb-plugin-manager"}`）
- 安装新插件：`run plugin-manager.install {"pkg":"@godcreator/gwb-<名>"}`——返回内容里带新条目的 `entryId`；
  `run plugin-manager.list` 里它是 `active: true` 就成功了，下一次调 `index` 就能看到它的命令
- 插件有新版本：`run plugin-manager.update {"all":true}`，成功后 `run shell.reload` 整页重新加载（升级到 `gwb-mcp` 自己时连接会断一次，
  重连后用 `run plugin-manager.list` 核对，再调 `shell.reload`）
- 内核有新版本：`run plugin-manager.update {"specs":{"@godcreator/gwb-kernel-desktop":"latest"}}`，回执里 `pluginsOutsideRange` 是 peer 范围不包含新内核的插件，告诉用户；
  `restartRequired` 为 `true` 时关掉窗口（用命令行关就对 `runtime.json` 里那个 pid 调 `(Get-Process -Id <pid>).CloseMainWindow()`）→ 从开始菜单重新打开。
  重启之后 `run plugin-manager.list` 里 `kernelUntested` 为 true 的插件就是这些

## 开发插件

上面装好的工作台就是开发环境：建插件仓、在隔离 home 里验证、发版都是 devkit 插件的命令，做法写在说明书 `gwb-devkit`
（`run skill.read {"name":"gwb-devkit"}`）与 `gwb-release` 里。这一节只讲开始之前机器上要多准备的几样，
改的同样是用户级配置，动手前告诉用户。

1. **Node 24 以上与 git**：插件模板的构建脚本直接用 `node` 运行 `build.ts`，模板的 `package.json` 写着 `"engines": { "node": ">=24" }`；
   `devkit.release` 要求仓的 git 工作区干净。`node --version` 输出 24 以上、`git --version` 有输出就是装好了；
   没有的话先征得用户同意，再 `winget install OpenJS.NodeJS.LTS` 与 `winget install Git.Git`，装完开一个新的 PowerShell 重新确认
2. **插件发到用户自己名下**：`@godcreator` 只有维护者能发。用户向这台 gitea（`https://git.tianshen02.online:28377`）的管理员要一个账号，
   下面把用户名写作 `<用户名>`。用户登录后在「设置 → 应用」生成一个访问令牌，权限里 package 选读写
3. **往 `~/.npmrc` 追加这个用户的两行**（其他行一律不动，`@godcreator` 那行保留）：

   ```
   @<用户名>:registry=https://git.tianshen02.online:28377/api/packages/<用户名>/npm/
   //git.tianshen02.online:28377/api/packages/<用户名>/npm/:_authToken=<令牌>
   ```

   第一行让安装与 `devkit.release` 找到这个包名范围的源，第二行是发布凭据。令牌向用户要，别写进回复与日志
4. **建仓时带上包名范围与发布目标**：

   ```
   run devkit.scaffold {"name":"<短名>","dir":"<还不存在的绝对路径>","scope":"@<用户名>","registry":"https://git.tianshen02.online:28377/api/packages/<用户名>/npm/"}
   ```

   包名是 `@<用户名>/gwb-<短名>`，发布目标写进插件包的 `publishConfig.registry`。之后照 `gwb-devkit` 在隔离 home 里验证，照 `gwb-release` 发版，
   再 `run plugin-manager.install {"pkg":"@<用户名>/gwb-<短名>"}` 装进 default

别的机器要装这个插件：在那台机器的 `~/.npmrc` 加上第 3 步的第一行，再 `run plugin-manager.install`。
