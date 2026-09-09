# gwb-kernel

god 工作台的**正线**：最小的、能正常运行插件的那个版本。

**2026-09-09 从两进程改成单进程**：cordis 从宿主子进程搬进 Electron 主进程，整个应用只剩
主进程与渲染进程两个。理由一句——宿主子进程存在的唯一目的是把件跟 Electron 隔开，而件真正
要的恰恰是 Electron（开窗、菜单、子进程、`electron` 这个模块本身），隔开的那道墙上于是长出了
fd3 协议、`gwb://`、exports 解析、日志四路管道，全是为绕墙而生。墙拆了它们一起没了。
重构在实验目录 `gwb-kernel-min` 里端到端验通（外壳、日志、总线、hello、node-cli、py-cli
六件按新契约改造后真机跑过）再整套搬回来的。

文档站已跟上单进程线，`pnpm doc` 全绿；改机制页要连引用一起复核（`pnpm doc:confirm`）。

## 内核只做六件事，一个文件

|              | 是什么                                                                                                   | 在哪                              |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------- |
| 铺 home       | 建目录、缺什么补什么（`package.json`、空 `cordis.yml`），不覆盖                                                         | `apps/desktop/src/main.ts`      |
| 起 cordis     | `Context` 加 `baseUrl` 指向 home，挂官方 loader 与 include                                                    | 同上                              |
| 解析裸名（node 半） | 主进程没有 `--expose-internals`，内核给 `loader.internal` 塞五行按 home 解析                                         | 同上                              |
| 解析裸名（浏览器半）   | 扫 home 清单里各包声明的 `gwb.shared`，解析成 `file://` importmap，随外壳地址推给页面，页面注完表才 import 外壳。内核不认识 react，只搬运提供方的声明 | 同上                              |
| 开窗与桥         | 一扇窗；`gwb:command` 派给 `ctx.gwbCommands`；`gwb:event` 推事件；`gwb:shell` 告诉页面外壳是谁                           | `src/main.ts` `src/preload.cjs` |
| 页面根          | 听 `onShell`，`import` 那个 URL，调默认导出；没有外壳、或外壳起不来时画一份**只读现状**（各条目到哪一步、最近的错误行），没有按钮                        | `src/index.html`                |
| 自己出错人看得见     | cordis 日志全量进 stderr 加 `<home>/gwb.log`；两个 `process.on` 只记不退；`main()` 起不来先弹错误框再退                       | `src/main.ts`                   |

（表里七行，「开窗与桥」跟「页面根」是同一件事的两头。三个文件合计 383 行（含空行与注释）：
`main.ts` 275、`index.html` 89、`preload.cjs` 19，外加词汇表 62。）

**没有的**：`gwb://` 协议、exports 解析、`kernel.info`、日志缓冲与轮转、宿主子进程与 fd3 协议、
README 铺进 home、装机（内核不碰 pnpm），以及旧线阶段页与崩溃页那套机器（轮询、讣告、重试）。
这些全归件，或者归 Electron 自己（页面直接吃 `file://`）。没有外壳时那份只读现状不是它们的
回归：只画内核已经攥着的数据（loader 的条目树、logger 的缓冲），**不归因、不重试、不自动恢复**，
边界见文档站「刻意不做」。

importmap **曾经**试过归外壳（2026-09-09 上午的版本），当天推翻：它是页面级的运行时服务，
没有外壳时别的浏览器半也得解析得到 react，而且共享包的声明权该在提供方不在消费方。现在是
内核的「浏览器半取址」。

## 契约面：六个名字加一个形状

node 半 `ctx.gwbKernel`：`dataDir`、`emit(payload)`、`setShell(url) → 撤销函数`。
页面 `window.gwb`：`command(name, args)`、`on(cb)`、`onShell(cb)`。
外壳模块：默认导出 `(root: HTMLElement) => { dispose?() } | void`。
正本在 `packages/gwb-plugin-api/src/index.ts`（`@godcreator02/gwb-plugin-api` 0.1.0，已发本机 registry）。

件的浏览器半地址由件自己从 `import.meta.url` 算，内核不认识任何包名、角色名、导出名。

内核自己的话与渲染层的 console 也走 `ctx.logger`（名字 `kernel` / `renderer`），所以任何件挂
一个 exporter 就收齐三路。内核为窗格不铺任何管道。

## 件在新契约下长什么样

| 件                                          | 改了什么                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gwb-shell`                                | node 半 `ctx.effect(() => kernel.setShell(new URL('./client.js', import.meta.url).href))`；登记 `shell.env` 命令回 home 与三张样式表的 `file://` 地址（令牌表按包解析）；浏览器半的默认导出 `mountShell(root)` 问一次 `shell.env` 再调原来的 `bootShell`；窗格注册表加 `client` / `style` 两个地址字段，开格按注册表现取 |
| `gwb-logger`                               | node 半真的成了日志件：挂第二个 cordis exporter、从 `ctx.logger.buffer` 补历史、自己缓冲两千条、经 `gwbKernel.emit({ t: 'gwb-logger', line })` 推、两条命令 `logger.backlog` / `logger.where`；浏览器半订 `window.gwb.on` 认自己的记号；三路是 `plugin` / `kernel` / `renderer`                           |
| `gwb-hello` 等窗格件                           | 两格 `registerPane` 各加 `client` 与 `style` 地址。其余一行没动                                                                                                                                                                                                       |
| `gwb-commands` `gwb-node-cli` `gwb-py-cli` | 代码一行没动，只换了依赖来源。`ELECTRON_RUN_AS_NODE` 那一套在主进程里照样对                                                                                                                                                                                                       |

窗格件要改的只有一处：注册时报 `client`（与可选的 `style`），地址从自己的 `import.meta.url` 算。

## 准入判据：两道关，都得过

**一、凡是「第一个插件存在之前必须发生的事」，才进内核。其余一律皆插件。**

**二、真遇到需求才加。** 不是「将来可能要」「顺手做了吧」「母仓有这个」——是某件事**此刻
就干不成**，而且干不成的现场说得出来：谁、在做什么、卡在哪。

加功能的默认形态是**加一个插件**，不是往内核里加一段。往内核里加之前先问：这件事能不能
由某个件提供、由 cordis 的服务注入送到用得着的地方去？能，就该是插件。

两道关一旦松动这个仓就没有存在理由了。拿不准就按「不进」处理——加回来永远比拿掉容易。

单进程之后这两关更好用了：**件跑在主进程里意味着件拿得到 `electron`**——开窗、菜单、托盘、
对话框、协议处理、子进程，全是件的事，内核一条都不用代办。

## 撞过的墙

* Electron ESM 主进程**不能顶层 `await app.whenReady()`**：ready 要等入口模块求值完才发，
  互相等死，整个进程静默挂住。`main.ts` 里已经处理，别改回去。
* cordis loader 的 `internal` 只在 `import(name, baseUrl)` 一处用，是实例上的普通字段；没有
  `--expose-internals` 时它是 `undefined`，件按 loader 自己的位置解析、**静默**挂不上。
* 工作区 `pnpm-workspace.yaml` 的 `autoInstallPeers: false` 与 `linkWorkspacePackages: true`
  是撞出来的：registry 上的件 peer 着 `gwb-commands >=0.0.1`，pnpm 会拿工作区里那个还没发的
  版本去满足、再去 registry 拿它，装当场失败。
* stderr 对端断了（没有终端起）每写一次抛一次 EPIPE，`main.ts` 里吞掉，文件那投照旧。

## 怎么跑

```powershell
pnpm install
cd apps\desktop; pnpm build          # tsc 直出到 dist/，无打包器（不再有 electron-vite）
.\run.cmd                            # 落 default home（%APPDATA%\gwb-kernel\homes\default）
$env:GWB_HOME='x'; .\run.cmd         # 名字 → homes\x；给路径（含 \ 或 /）就用那个目录
.\run.cmd --remote-debugging-port=9335   # CDP 取证，Chromium 开关命令行上就生效，内核不管它
```

根上的门禁是 `pnpm check`（`build:api` + `typecheck` + `lint` + `test`）。页面取证的小工具与规矩
归 `gwb-devkit` 件（`cdp-eval` 是它登记的一条 node CLI；表达式放文件不放命令行；起内核带的
CDP 端口别跟别的会话正在跑的实例撞上，撞上取到的是别人的页面）。日志在 `<home>\gwb.log`：
内核自己的话、件的、渲染层 console 转来的，全在这一份里。仓里不放验场、不放探针，临时东西
一律进 scratchpad，跑完即废。

## 服务命名：一律 `gwb` 开头

* **内核提供**：`gwbKernel`（永不撤销，用词汇表包的 `requireKernel` 取，**不写进 `inject`**）
* **件提供**：默认跟件名对应（`gwb-commands` 件 → `ctx.gwbCommands`）
* **例外：cordis 官方件的服务照它自己的**（`timer`、`loader`）——那不是我们的东西
* 消费方一律 `inject: ['gwbCommands']` 这样写

为什么全加而不是「通用名才加」，见文档站。

## 依赖写 peer 还是 dev：三档

| 情形                            | 写哪                       |
| ----------------------------- | ------------------------ |
| 运行时真 import 了它                | `peer`（或 `dependencies`） |
| **只 import type，但它出现在导出的类型里** | **`peer`**——消费方必须解析得到    |
| 只在实现内部用类型、不出现在导出面             | `dev`                    |

中间那档漏了两次，现场见文档站。

## 容器里的邻居

| 单元                             | 是什么                      | 这个仓怎么用它                                                   |
| ------------------------------ | ------------------------ | --------------------------------------------------------- |
| `26090705ymz\gwb-kernel-min`   | 单进程重构的**实验目录**，用完即弃      | 结论已整套搬进本仓，探针读数该进文档站的轨迹。它只读，别再往里写，件迁完就删                    |
| `26090709qzp\gwb-base-plugins` | **正线的件仓**，十二件正在迁到 0.1 契约 | 件在那儿改、在那儿发版；本仓只消费                                         |
| `26090412vav\god-workbench`    | 母仓，**已退役**               | 只作参考：某处当初为什么那么做、踩过什么坑。结构、分层、包划分一概不抄                       |
| `26090623hyz\gwb-plugins`      | 旧的 11 件，**已退役**          | 同上                                                        |
| `26090702tpu\gwb-catalog`      | 推荐清单                     | 装什么件由人挑，推荐将来从这儿来                                          |
| `26090520zzv\registry`         | 本机 Verdaccio             | 件的包源：件仓 publish 到这儿，home 从这儿装。`@godcreator02` scope 指的就是它 |

**件的包名：`@godcreator02/gwb-<件名>`**。加 `gwb-` 前缀跟废弃那批错开（`@godcreator02/shell`
那些已被占着）。scope 不换。

## 干活之前：知识随件走

本仓不放 skill。说明书住提供能力的那个件，随包发、经 `gwb-mcp` 件开给 agent
（`skill://gwb/<名>/SKILL.md` resource，server instructions 里逐条点名）。连着 `default` home
的会话直接读；没连着就按包内路径 Read：

| skill                         | 住哪                                                                                  | 什么时候用                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `gwb-devkit`                  | `gwb-devkit` 包 `skills/`（仓 `D:\unitfolders\260908dkv\gwb-devkit`）                   | 写件的整条路；**改内核的验机路子在末尾一节**：隔离 home 与命名法、产物是不是新的、四种「看着成了」、怎么从页面取证 |
| `livedoc-docs` / `trajectory` | `live-doc-cli` 包 `skills/`（仓 `D:\unitfolders\26090315xby\god-live-doc`），devkit 代为挂上 | 写或改文档站之前；记轨迹卡之前                                                |
| `gwb-decide`                  | 总控台 `D:\unitfolders\26090520ntn\console\.claude\skills\`（宿主 skill，不随件）              | 遇到选型、判「进内核还是做成件」、决定要不要做某个功能之前。推完交给人拍板，拍板后记轨迹卡                  |

判据与代价见[知识随件走](/docs/trajectory/2026-09-09-knowledge-rides-package)。

## 注释与文档：三层分流

| 层              | 只装                  | 判据            |
| -------------- | ------------------- | ------------- |
| 这份 `AGENTS.md` | 每次会话都得知道的硬约束        | 不知道就会做错事      |
| 文档站（钉代码）       | 为什么这么定、撞过什么、判据怎么来的  | 需要时查；代码一变就报黄  |
| 代码注释           | 只写现状：这个文件装什么、这行在做什么 | 离了它读不懂**这一行** |

**注释里不写文档站的页名或锚点**——livedoc 只钉「文档 → 代码」，反向没有任何守卫，
写死位置必然腐烂而且没人发现。要指路就写「见文档站」四个字。

文档站正本在 `docs-site/content/docs/`，`pnpm --filter gwb-kernel-docs-site dev` 起在 4314。
**仓根 `README.md` 与这份 `AGENTS.md` 都是生成物，别手改**——正本分别是 `content/docs/readme.mdx`
与 `content/docs/agents.mdx`，改完在 `docs-site` 跑 `pnpm livedoc render --target ai` 重摆，
一起提交。`CLAUDE.md` 只有一行 `@AGENTS.md`，不派生。

**文档检查不在 `pnpm check` 里**——它要起文档站的解析链，太慢，每次跑测试都带上不值。
单独两条 `pnpm doc` / `pnpm doc:confirm`。改机制再补文档是独立的一步，别在别的活里顺手改一半。

## 蹲住这条线

这个仓最容易死的方式不是写不出来，是**慢慢长回母仓的样子**——每一条「顺手加上」的
自动化都有它自己的道理，加够二十条就又是 5100 行。

母仓成了参考之后这件事更危险：去查一个坑怎么解的，顺手把解法连同它周围那一圈机制
一起搬回来，是最自然不过的动作。**查它是为了知道坑在哪，不是为了抄它怎么绕。**

每次要往内核里加东西，先过一遍准入判据那两道关。过不了就做成插件。
