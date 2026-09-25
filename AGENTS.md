# gwb-kernel

god 工作台的内核：一个 Electron 应用，cordis 在主进程里，只做第一个插件运行前必须完成的事，其余都做成插件。
本仓只放两样：内核应用 `apps/desktop`（npm 包，包根同时导出内核给插件与页面的接口类型）、安装包（启动器 `apps/launcher` 与打包脚本 `installer/`）。内核包和插件一样装在 home 里，安装包只带启动器与 Electron。插件一个也不放——命令插件 `@godcreator/gwb-commands` 在基础插件仓 `gwb-base-plugins`，插件管理 `@godcreator/gwb-plugin-manager` 在 devkit 仓 `gwb-devkit`，都是 `cordis.yml` 里的普通插件。

现状从文档站入口读（`docs-site/content/docs/index.mdx`，启动文档站后是 `/docs`）：入口页就是接缝图，也是全部包的总索引；只做什么、刻意不做什么、内核为什么装在 home 里、插件怎么声明兼容哪个内核见同目录 `design.mdx`，
十条接缝各一页见 `seams/`，怎么跑、怎么验证、怎么发版见 `develop.mdx`；每个包一个模块页（含每个测试文件证明什么、代码地图）：内核应用见 `desktop/`（包根导出的接口类型见 `desktop/api.mdx`），安装包（含启动器与打包步骤）见 `installer.mdx`。

## 准入判据

1. **只有「第一个插件运行之前必须完成的事」才进内核。** 其余一律做成插件
2. **确实遇到需求才加。** 现在就做不成，而且说得出场景：谁、在做什么、卡在哪

拿不准按「不进」处理。这个仓最容易出的问题是慢慢变回旧版工作台仓 god-workbench（已删除）的样子。

## 遇到过的问题：别改回去

* Electron ESM 主进程**不能顶层 `await app.whenReady()`**：ready 要等入口模块求值完才触发，互相等待，静默卡死
* 不给 `loader.internal` 配包名 import（bare specifier，直接写包名、不带相对路径的 import）解析，插件按 loader 所在位置解析，**静默**加载失败
* 工作区链接会替 registry 满足 peer：装包出问题先读当前的 `pnpm-workspace.yaml` 与 pnpm-lock 的 `settings`，别按旧配置办
* 没有终端时每次写 stderr 都抛 EPIPE，`main.ts` 捕获忽略，日志文件照写

## 契约与版本号

内核给插件与页面的接口类型正本是 `apps/desktop/src/api.ts`，从内核包的包根导出，版本号就是内核包的版本号。
内核包什么改动升 x、什么升 y，见文档站「开发」页的「发版」（`docs-site/content/docs/develop.mdx`）；`devkit.release` 的 `packages` 只写 `["apps/desktop"]`。

## 怎么跑

**日常从安装版启动，不进这个仓**（开始菜单「gwb-kernel」）。安装包：`pwsh installer\scripts\build.ps1`，安装包带什么、打包步骤与打完怎么验证见文档站「安装包与启动器」页（`docs-site/content/docs/installer.mdx`）；
新机器安装照仓根 `INSTALL.md`。别日常直接运行 `build\dist\win-unpacked\`——每次构建整个重新生成，会和运行中的 exe 冲突。

**改内核本身才进这个仓**，只在隔离 home 里实际运行验证。内核不带插件，隔离 home 里的命令插件等插件要先装好：用 `devkit.home.new` 新建（它装好基础插件、用安装版打开，关掉窗口后再从源码启动同一个 home），或照 `INSTALL.md` 第 3 步用 pnpm 装。`pnpm start` 会先构建内核，再启动：

```powershell
pnpm install
$env:GWB_HOME = '<这次验什么>-<yyMMddHHmm>'
cd apps\desktop; pnpm start
```

提交前检查 `pnpm check`；文档检查不在里面，在仓根单独运行 `pnpm doc`。

## 文档与注释

* **知识随插件发布**，本仓不放说明书：在隔离 home 里验证读 skill「gwb-devkit」，升版本号、发版读「gwb-release」，写文档与轨迹卡读「docfirst-docs」「trajectory」；选型先把需求逐条问清楚（`matt-pocock` 的 grill 一节），推荐方案交人决定，决定后写轨迹卡
* 这份 AGENTS 只放硬约束；为什么、遇到过什么问题写在文档站；代码注释只写现状，**不写文档站的页名或锚点**（要指路写「见文档站」）
* 仓根 `README.md`、`AGENTS.md`、`INSTALL.md`、`CLAUDE.md` 是生成物，正本在 `docs-site/content/outputs/`，在 `docs-site` 运行 `pnpm docfirst render` 生成
