# 安装 gwb（写给 agent）

你是替用户在一台 Windows 机器上安装 gwb 的 agent。**安装包只带启动器与 Electron，不带内核、不带插件，也不带 pnpm——内核包、`cordis` 与插件都由你用机器上装好的 pnpm 12（第 1 步）装进 home。** 启动器启动时从 home 里加载内核，home 里没有内核包就弹框说明、不启动。
照下面做完，用户得到一个装好 11 个基础插件（包括命令插件、插件管理、MCP 入口）、MCP 入口开在 `http://127.0.0.1:2870/mcp` 的工作台，
之后你（或别的 agent）通过这个 MCP 入口干活。命令一律在 PowerShell 里运行。

## 0. 先确认装没装过

`%APPDATA%\gwb-kernel\homes\default\cordis.yml` 已经存在、里面至少有一行 `- id:`——**已经装过，只升级，
别做第 3 步**（它会覆盖用户的 home）。`homes\` 下的其他目录是别的 home（测试用的），跟这个判断无关：

* **home 的 `package.json` 里没有 `@godcreator/gwb-kernel-desktop`**：这个 home 是旧安装包（内核打在安装包里）装的。关掉工作台窗口，
  在这个 home 里照第 3 步装上内核包与 `cordis`（只做「装内核包与 cordis」那两条，`cordis.yml` 与插件不动），再装新版安装包（第 2 步），然后启动。
  顺序不能反：新安装包只带启动器，先装它、home 里还没有内核包，启动时就弹框
* 升级内核：连上 MCP 入口之后 `run plugin-manager.update-kernel`（装新的内核包、把 home 根上的 `cordis` 对齐到内核要的版本），
  然后重启工作台（关掉窗口、从开始菜单重新打开）才生效。安装包只带启动器，只有出了新版安装包才需要重装
* home 里还装着 `@godcreator/gwb-plugin-sources`：它已经退役，四条命令并回了插件管理（`plugin-manager.search`、`plugin-manager.source.add` / `list` / `remove`，
  参数与回执不变）。连上 MCP 入口之后 `run plugin-manager.uninstall {"pkg":"@godcreator/gwb-plugin-sources"}` 卸掉它
* 升级插件：连上 MCP 入口之后 `run plugin-manager.update-all`，或让用户在「插件管理」窗格点「全部更新」。内核包与 `cordis` 不归它升

## 1. 机器上的前置条件（改的是用户级配置——动手前告诉用户要改什么）

1. **pnpm 12（不低于 12.4.2），装在两个固定位置之一**：插件管理与 devkit 只按顺序检查这两个位置、第一个存在的作数，
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

## 3. 初始化 default home

注意 PowerShell 里 `$home` 是保留变量，别拿它当变量名。`$pnpm` 是第 1 步第 1 条找到的那个 pnpm，这里再取一次。

```powershell
$pnpm = @("$env:LOCALAPPDATA\pnpm\bin\pnpm.exe", "$env:APPDATA\npm\node_modules\pnpm\pnpm.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$gwbHome = "$env:APPDATA\gwb-kernel\homes\default"
New-Item -ItemType Directory -Force $gwbHome | Out-Null
[IO.File]::WriteAllText("$gwbHome\package.json", '{ "name": "gwb-home", "private": true }')
Set-Location $gwbHome

# 装内核包与 cordis：两个都写精确版本号，cordis 的版本就是内核包 peer 里写的那个
$kernel = & $pnpm view @godcreator/gwb-kernel-desktop dist-tags.latest
& $pnpm add --save-exact "@godcreator/gwb-kernel-desktop@$kernel"
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
- id: logger
  name: '@godcreator/gwb-logger'
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
& $pnpm add @godcreator/gwb-commands @godcreator/gwb-data @godcreator/gwb-settings @godcreator/gwb-skills @godcreator/gwb-logger @godcreator/gwb-plugin-manager @godcreator/gwb-shell @godcreator/gwb-baseui @godcreator/gwb-node-cli @godcreator/gwb-devkit @godcreator/gwb-mcp
```

* 内核包与 `cordis` 装完读回核对：`node_modules\@godcreator\gwb-kernel-desktop\package.json` 的 `version` 等于 `$kernel`，
  `node_modules\cordis\package.json` 的 `version` 等于 `$cordis`。对不上就把 home 的 `package.json` 里那一项改成精确版本号再运行一次
  （清单里原来写着 `^` 范围时，pnpm 会沿用范围、装上别的版本）。内核与所有插件用的是 home 根上这一份 `cordis`
* `cordis.yml` 是条目表：一行一个插件，`id` 必须手写（不写的话每次启动都会换一个随机字符串）；内核包与 `cordis` 不是插件，不写进去
* 命令插件（`gwb-commands`，页面和 MCP 入口的命令都经它执行）与插件管理（`gwb-plugin-manager`，之后装卸、升级插件都经它）是普通插件，和别的插件一样写进 `cordis.yml`、装进 home
* 除了内核包与 `cordis`，只装插件、不装库：页面用的 react 随内核包装上，
  设计令牌表随 `gwb-shell` 装上。**别再安装 `gwb-shared-react` / `gwb-tokens`**：这两个包已停止发布
* 退出码为 0 就成功。输出里如果有一行 `Issues with peer dependencies found`：说明有插件还没适配它上游的新版本，
  包照样装上了，但那个插件可能启动不了——在 home 里运行 `& $pnpm peers check` 拿到明细，原样告诉用户

## 4. 启动、核对

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\gwb-kernel\gwb-kernel.exe"
```

几秒内就绪。轮询到 `runtime.json` 里出现 `mcp` 这个字段就算启动完成：

```powershell
$rt = "$env:APPDATA\gwb-kernel\homes\default\runtime.json"
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep 1
  if ((Test-Path $rt) -and (Get-Content $rt -Raw | ConvertFrom-Json).mcp) { break }
}
Get-Content $rt
```

* `runtime.json` 里有 `version`（内核版本）与 `"mcp": { "url": "http://127.0.0.1:2870/mcp" }`——MCP 入口的地址
  **以这个字段为准**
* 同目录的 `gwb.log` 一行一条，格式是 `<时间> <级别> <来源> <内容>`。应该有 `info kernel up` 与 `info gwb-mcp MCP 入口已就绪` 两行（旧版 gwb-mcp 写的是「MCP 门就绪」）；
  `Select-String "$env:APPDATA\gwb-kernel\homes\default\gwb.log" -Pattern '^\S+ error '` 应当没有任何输出
  （`warn` 行读一读，不算失败）
* 能看到窗口的话：底部状态栏右边写着 `gwb <版>`，这个版本号就是 `runtime.json` 里的 `version`

`runtime.json` 在程序退出后也会保留（下一次启动时整份重写），所以只凭它存不存在判断不了程序还在不在运行——
要确认就检查它的 `pid` 是不是一个活着的进程。

## 5. 连接 MCP 入口

MCP 入口的地址在 `runtime.json` 的 `mcp.url`（default 就是 `http://127.0.0.1:2870/mcp`），只绑定本机，**要求
`Authorization: Bearer <token>`**：token 每个 home 一份，存在 `<home>\mcp\secret.json`（字段 `token`），重启不变；
没带或对不上一律返回 401。

先不改任何客户端配置，用 MCP 入口自带的命令行客户端验证一遍（零依赖；不给 token 时它读 default home 的凭据文件）。
它要 node 18 起才能运行，而且装在第 3 步的 home 里——第 3 步没装成就没有它。机器上没有 node 的话跳过这一段，直接在客户端里配置、调 `index` 验证：

```powershell
$gwbHome = "$env:APPDATA\gwb-kernel\homes\default"
$client = "$gwbHome\node_modules\@godcreator\gwb-mcp\bin\client.mjs"
$url = (Get-Content "$gwbHome\runtime.json" -Raw | ConvertFrom-Json).mcp.url
node $client --url $url index
node $client --url $url run plugin-manager.list
node $client --url $url run skill.list
```

MCP 入口能连通，再给用户常用的客户端配置上。先拿到已带请求头的配置片段：`node $client --url $url run mcp.token`
返回 `{ token, file, mcpServers }`，`mcpServers` 里已带 `headers`，原样复制就能连上（**返回内容含明文凭据**，别贴到
公开的地方）：

* Claude Code：`claude mcp add --transport http gwb http://127.0.0.1:2870/mcp --header "Authorization: Bearer <token>"`
  （要所有项目都能用就加 `--scope user`），然后开新会话，或在会话里 `/mcp` 重连
* 其他客户端：原样复制上面 `mcpServers` 那一段（形状是 `{ "gwb": { "type": "http", "url": …, "headers": { "Authorization": "Bearer <token>" } } }`）

连上后**先调 `index`**：它返回的 instructions 讲清楚之后怎么干活。再核对：

* `run plugin-manager.list` 返回第 3 步装的 11 个插件，各带一个条目、`active: true`；另有内核包与 `cordis` 两行，没有条目。
  插件的 `kernelUntested` 为 `true` 只是报告：它还没在清单里声明兼容哪个内核，照常加载，不算失败
* `run skill.list` 能列出说明书，至少有 `mcp`、`gwb-commands`、`gwb-plugin-manager`、`gwb-devkit`
* `run plugin-manager.search` 能列出源上可装的插件——「插件管理」窗格的「可装」栏用的就是它

做完，把第 1 步改过的配置告诉用户。

## 装一个别的 home（测试用）

同一台机器上可以有多个 home，各自一个目录、各自一套插件，可以同时运行（同一个 home 只能运行一个实例）。照上面装别的 home 时：

* 把第 3 步起的 `$gwbHome` 换成那个目录；启动前设 `GWB_HOME`：写名字就是 `%APPDATA%\gwb-kernel\homes\<名字>`，写带路径分隔符的就是那个目录本身。
  例：`$env:GWB_HOME = $gwbHome; Start-Process "$env:LOCALAPPDATA\Programs\gwb-kernel\gwb-kernel.exe"`
* MCP 入口的端口不是 2870，一律从那个 home 的 `runtime.json` 的 `mcp.url` 取
* 命令行客户端要显式给那个 home 的 token：`node $client --url $url --token (Get-Content "$gwbHome\mcp\secret.json" -Raw | ConvertFrom-Json).token index`
  （也可以设环境变量 `GWB_MCP_TOKEN`）。不给的话它用 default home 的 token，会 401

## 常见问题

| 现象                                         | 多半是                                                        | 怎么办                                                                    |
| ------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm add` 报 404，找不到 `@godcreator/…`       | 第 1 步第 2 条那行没配                                             | 补上再装                                                                   |
| 启动时弹框说 home 里没有内核包                         | 第 3 步的内核包没装，或装在了别的 home                                    | 照第 3 步在这个 home 里装内核包与 `cordis` 再启动                                     |
| 启动时弹框说 Electron 版本不满足内核包要求                 | 安装包太旧，内核包要的 Electron 更新                                    | 装最新的安装包                                                                |
| 装完提示 `Issues with peer dependencies found` | 有插件没适配上游的新版本                                               | `& $pnpm peers check` 看明细告诉用户                                          |
| 报版本太新、minimum release age                  | 第 1 步第 3 条没配                                               | 补上再装                                                                   |
| 第 1 步找不到 pnpm，或版本不是 12.x、低于 12.4.2         | pnpm 没装、装在别处，或版本不对                                         | 照第 1 步第 1 条装到两个固定位置之一                                                  |
| 连 npmjs 超时                                 | 网络                                                         | 按第 1 步第 4 条换镜像                                                         |
| 窗口里只有只读状态页、没有状态栏                           | 外壳没加载成功                                                    | 看 `gwb.log` 里的 `error` 行，多半是第 3 步没装成功                                  |
| 页面上的命令都回「没有命令服务」                           | 命令插件没加载成功                                                  | 看 `cordis.yml` 里有没有 `commands` 那条、home 里装没装 `@godcreator/gwb-commands` |
| MCP 入口连不上                                  | 工作台没启动，或 2870 端口被占用（default 的 MCP 入口不换端口）                  | 看 `runtime.json` 有没有 `mcp`；在 `gwb.log` 里找 `gwb-mcp` 那行；腾出 2870 端口再启动   |
| 「插件管理」里安装插件失败，回执说找不到 pnpm 或版本不对            | 两个固定位置都没有 pnpm，或找到的不是 12.x、低于 12.4.2；插件管理 0.8.3 起不再自带 pnpm | 照第 1 步第 1 条装好，回执里写着检查了哪两个位置                                            |

## 之后

* 找可装的插件：`run plugin-manager.search`；装第三方源（比如 `@j`）上的插件，先 `run plugin-manager.source.add {"scope":"@j","owner":"J"}`
* 安装新插件：`run plugin-manager.install {"pkg":"@godcreator/gwb-<名>"}`——返回内容里带新条目的 `entryId`；
  `run plugin-manager.list` 里它是 `active: true` 就成功了，下一次调 `index` 就能看到它的命令
* 插件有新版本：`run plugin-manager.update-all`（升级到 `gwb-mcp` 自己时连接会断一次，重连即可）
* 内核有新版本：`run plugin-manager.update-kernel`，回执里 `pluginsOutsideRange` 是 peer 范围不包含新内核的插件，告诉用户；
  然后关掉窗口（用命令行关就对 `runtime.json` 里那个 pid 调 `(Get-Process -Id <pid>).CloseMainWindow()`）→ 从开始菜单重新打开。
  重启之后 `run plugin-manager.list` 里 `kernelUntested` 为 true 的插件就是这些
