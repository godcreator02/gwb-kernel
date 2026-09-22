# gwb-kernel

god 工作台的内核：一个 Electron 应用，cordis 住主进程，只做第一个件跑起来之前必须发生的事，其余一切皆件。
现状从文档站入口读（`docs-site/content/docs/index.mdx`，起站后是 `/docs`），只做什么、刻意不做什么见同目录 `boundary.mdx`。

## 准入判据：两道关，都得过

1. **凡是「第一个件存在之前必须发生的事」，才进内核。** 其余一律皆件
2. **真遇到需求才加。** 此刻就干不成，而且说得出现场：谁、在做什么、卡在哪

拿不准按「不进」处理。这个仓最容易的死法是慢慢长回母仓的样子——查母仓是为了知道坑在哪，不是抄它怎么绕。

## 撞过的墙：别改回去

* Electron ESM 主进程**不能顶层 `await app.whenReady()`**：ready 要等入口模块求值完才发，互相等死、静默挂住
* 不给 `loader.internal` 塞裸名解析，件按 loader 自己的位置解析、**静默**挂不上
* 工作区链接会替 registry 满足 peer：装包撞墙时先现读 `pnpm-workspace.yaml` 与 pnpm-lock 的 `settings`，别按老配置办事
* 没有终端时 stderr 每写一次抛 EPIPE，`main.ts` 里吞掉，文件照写

## 契约面

正本 `packages/gwb-plugin-api/src/index.ts`，与内核同号。抬版本号前读 devkit 的 skill「gwb-release」；发版走
`devkit.release {"dir":"<本仓>","packages":["packages/gwb-plugin-api"]}`，别在包目录手敲 `pnpm publish`（绕开树干净与产物白名单两道守卫）。

## 怎么跑

**日常从安装版起，不进这个仓**（开始菜单「gwb-kernel」）。安装包：`pwsh installer\scripts\build.ps1`，方案正本 `installer/SPEC.md`；
新机器装机照仓根 `INSTALL.md`。别日常直跑 `build\dist\win-unpacked\`——每次构建整个重生成，会撞在跑的 exe。

**改内核本身才进这个仓**，验机只在隔离 home（`devkit.home.new` 起的是安装版、不 build 本仓）：

```powershell
pnpm install
$env:GWB_HOME = '<这次验什么>-<yyMMddHHmm>'
cd apps\desktop; pnpm start
```

门禁 `pnpm check`；文档检查不在里面，单独 `pnpm doc` / `pnpm doc:confirm`。页面取证用 devkit 的 `devkit.cdp`，调试端口别跟别的会话撞。
实验材料落 `probes/<时间戳>_<目的>/`：一次实验一个目录、自包含、进 git、不进 pnpm workspace。

## 文档与注释

* **知识随件走**，本仓不放 skill：写件读 `gwb-devkit`，写文档与记轨迹读 `docfirst-docs` / `trajectory`，选型先盘问（`matt-pocock` 的 grill 一节），推完交人拍板、拍板后记卡
* 这份 AGENTS 只装硬约束；为什么、撞过什么住文档站；代码注释只写现状，**不写文档站的页名或锚点**（要指路写「见文档站」）
* 仓根 `README.md`、`AGENTS.md`、`INSTALL.md` 是生成物，正本在 `docs-site/content/outputs/`，改完在 `docs-site` 跑 `pnpm docfirst render`，一起提交；`CLAUDE.md` 只有一行 `@AGENTS.md`
