# 探针：单进程内核成不成立的四个问题

**这几个探针 2026-09-09 是在实验目录 `gwb-kernel-min` 里跑的，下面提到的路径按当时那个仓写**
（`src/`、`plugins/`、`homes/` 都在那个仓的根上）。搬进本仓后 `p1`/`p2`/`p3` 用的试验 home
挪到了 `probes/homes/`，脚本里的路径已改；读数是原样的，没有重跑。

Electron 44.1.1（node 24.19.0），cordis 4.0.0-rc.9，plugin-loader 1.0.0-rc.6。
每个探针把结果写成 `*.out.json`（不进仓），下面是当时的读数。

跑法：在 `apps/desktop` 下 `node_modules\electron\dist\electron.exe probes\<探针>.mjs`，
结果在同目录 `.out.json`。页面取证是 `node probes\cdp-eval.mjs <端口> probes\<表达式>.expr.js`。

`*.expr.js` 不是程序是**表达式**：整份文件当成一句喂给 `Runtime.evaluate`，求值结果就是读数，
所以它顶层是个不 await 的 IIFE。lint 在 `.oxlintrc.json` 里放过这几个文件，原因就是这个。

## 一 `p1-loader.mjs`：主进程里的 loader 能不能按 home 解析裸名

主进程 `execArgv` 为空，`ctx.loader.internal` 是 `undefined`。内核塞进去

```js
ctx.loader.internal = { import: (name, base) => import(pathToFileURL(createRequire(base).resolve(name)).href) }
```

之后 `homes/probe1` 里手写的裸名件 `gwb-probe-hello` 解析到 `<home>/node_modules/gwb-probe-hello/index.js`，
fiber 状态 2（ACTIVE），件在 `process.type === 'browser'` 里留下记号。**成立。**

顺带撞的墙：入口模块顶层 `await app.whenReady()` 会与 ready 互相等死，整个进程静默挂住。

## 二 `p2-file.mjs`：页面能不能直接吃 home 下的 `file://`

`loadFile` 起的页面，origin 是 `file://`。五项：

| 断言 | 读数 |
| --- | --- |
| 动态 `import()` 一个 `file://` 模块 | 成，拿到导出 |
| `<link>` 一张 `file://` 样式表并量计算样式 | 成，`rgb(1, 2, 3)` |
| 运行时注 importmap 指向 `file://`，再 import 用裸名的模块 | 成，且与直连同一文件是**同一份实例** |
| `fetch` 一个 `file://` | 成，200（预期不成，Electron 放行了） |
| JSON 模块 import | 成 |

**内核不需要任何资源协议。** `gwb://` 与 exports 解析整块不存在。

## 三 `p3-faults.mjs`：件在主进程里出错，应用活不活

`homes/probe3` 装一条好件加三条坏件：apply 同步抛、定时器里没人接的 rejection、定时器里同步抛。

- 挂了 `unhandledRejection` 与 `uncaughtException` 监听：三种全被接住，1.5 秒后收尾到达，窗口活着，
  好件 ACTIVE，`bad-apply` 状态 3，另两条状态 2（错发生在 apply 之后，fiber 不受影响）。
- 不挂监听（`P3_HANDLERS=0`）：也活到了收尾，stderr 上是 node 的 UnhandledPromiseRejectionWarning。
  定时器里的同步抛没在 stderr 露面，是否弹过模态框没有证据；**内核挂监听就不弹**，这条够用。

apply 里的同步抛在 cordis 这儿表现为 unhandledRejection，跟老宿主的现场一致。

## 四 内核 v0 端到端（`src/` 加 `homes/probe4`）

手写三件：总线（provide `gwbCommands`）、外壳（`setShell` 自己的 `client.js`，浏览器半注 importmap、
取表、逐格 import）、窗格（登记 `client` 地址、收报告落盘、`emit` 一条事件、最后 `import('electron')`
退出应用）。读数在 `homes/probe4/report.*.json`：

- 页面经 `file://` 引入外壳，外壳经总线取到窗格表，引入窗格，窗格里裸名 `probe-shared` 与直连同一
  文件是同一份实例（`sharedSame: true`）
- 窗格件 `emit` 的 `ping` 回到页面的 `window.gwb.on`
- 窗格件在主进程里 `import('electron')` 成功，`process.type` 是 `browser`，`app.exit` 退出了应用

内核合计 261 行（含空行与注释）：`main.ts` 147、`index.html` 38、`preload.cjs` 18、词汇表 58。

## 五 两个真件：外壳与日志件（`plugins/` 加 `homes/real1`）

从件仓复制 `gwb-shell` 0.0.16 与 `gwb-logger` 0.0.3 到 `plugins/`，按新契约改造（改了什么见
`AGENTS.md`），总线 0.0.2、data 0.0.3、shared-react 0.0.2、tokens 0.0.5 从本机 registry 装进
`homes/real1`，两个改造件以 link 装入。起内核带 `--remote-debugging-port=9333`，八秒后经 CDP 求值
（`real1-page.expr.js` / `real1-live.expr.js`）：

| 断言 | 读数 |
| --- | --- |
| 井起来了 | `.dv-groupview` 在，`html.dark` 在，body 底色 `oklch(0.19 0.005 286.033)`（令牌暗色值） |
| importmap 由外壳自己注 | 页面上一份 importmap，四个键 react / react/jsx-runtime / react-dom / react-dom/client，值全是 `file://` |
| 三张样式表走 `file://` | 令牌表来自 tokens 包目录，dockview 表与外壳表来自 `plugins/shell/dist/` |
| 窗格件自报地址 | 注册表那条带 `client` 与 `style`，都指向 `plugins/logger/dist/` |
| 日志格挂上、三路齐 | 格里 25 行；`logger.backlog` 回 24 条：件 21、内核 1、渲染层 2 |
| 实时回环 | 页面 `console.log('probe-live-line-8848')` → 内核 `console-message` → `ctx.logger('renderer')` → 日志件 exporter → `emit` → 窗格，800 毫秒内那一行出现在格里 |

日志里唯一的 warn 是外壳开机问 `theme.startupCss`（theme 件没装），跟老内核上的现象一样，归件。

## 六 importmap 归内核，再加四个真件（总线、hello、node-cli、py-cli）

同一天推翻第五节里「外壳自注 importmap」：改成内核扫 home 清单里各包的 `gwb.shared` 声明、解析成
`file://` 表随外壳地址推给页面。外壳退回单入口。复制总线、hello、node-cli、py-cli 进 `plugins/`，
前三者代码没动，hello 两格注册时加地址。`homes/real1` 七条条目，读数：

| 断言 | 读数 |
| --- | --- |
| importmap 是内核注的 | 页面上一份，四个 react 系裸名，外壳源码里已没有 `gwb-shared-react` 这几个字 |
| 三格窗格都自报了地址 | 注册表三条（日志、验收件、计数器）各带 `client` 与 `style`，指向各自 `dist/` |
| hello 两格真画出来了 | 标签条「日志 / 验收件 / 计数器」三个；验收格里的按钮底色 `oklch(0.92 0.004 286.32)`，是令牌值 |
| data 件在主进程里照常落盘 | `hello.probe` 回 `{ runs: 1 }`，目录 `<home>/data/hello` |
| node CLI 在主进程里跑得起 | `hello.node` 退出码 0，86 毫秒。`process.execPath` 是 electron.exe，`ELECTRON_RUN_AS_NODE` 照旧有效 |
| python CLI 在主进程里跑得起 | 首跑 uv 建 venv 七秒，`hello.python` 退出码 0，4.4 秒 |
| 日志格实时回环 | 先点「日志」标签（dockview 只渲染激活的格），再往 console 打一句，800 毫秒内出现在格里 |
