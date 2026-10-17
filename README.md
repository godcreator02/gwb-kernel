# gwb-kernel

> **要在一台机器上安装 gwb？** 见 [INSTALL.md](INSTALL.md)——写给替用户安装的 agent。安装包只带启动器与 Electron；内核包、`cordis` 与插件由 agent 按那份说明用 pnpm 装进 home。

god 工作台的内核：一个 Electron 应用，cordis 运行在主进程里，负责主进程插件启动与页面模块解析环境——初始化 home、创建 cordis 实例并加载插件、
主进程与页面的包名 import（bare specifier，直接写包名、不带相对路径的 import）解析、创建窗口与 IPC 通道、自身出错时让人看得见——其余功能全部由插件实现。

本仓只放内核应用 `apps/desktop` 和安装包（启动器 `apps/launcher` 与打包脚本 `installer/`）。内核应用发布成 npm 包，和插件一样装在每个 home 里，由启动器加载；它的包根还导出内核给插件与页面的接口类型，插件从这里 `import type`。插件的源码在各自的仓里：命令插件 `@godcreator/gwb-commands` 在基础插件仓 `gwb-base-plugins`，
插件管理 `@godcreator/gwb-plugin-manager` 在生命周期插件仓 `gwb-lifecycle-plugins`；它们和别的插件一样写在 home 的 `cordis.yml` 里。

## 开发

有两条启动方式，各管一件事：**日常使用、在新机器上安装**走安装版（开始菜单「gwb-kernel」，装法见 [INSTALL.md](INSTALL.md)），不进这个仓；
**改内核本身**才从源码启动，而且只在隔离 home 里运行、不碰日常用的 default。下面是源码这一条：

```powershell
pnpm install
pnpm check                              # 构建内核包（连同包根的类型声明）+ typecheck + lint + test
$env:GWB_HOME = 'try-1'; cd apps\desktop; pnpm start   # 构建并在隔离 home 里启动本仓内核
```

隔离 home 里要先装好命令插件等插件（用 devkit 的 `devkit.home.new`，或照 `INSTALL.md` 用 pnpm 装），否则页面只显示只读状态页。
安装包由 `installer/` 生成。

## 文档

文档站在 `docs-site/`（god-docsite + docfirst，自己一套依赖，不在 pnpm 工作区里），从首页读起：内核是什么、只做什么不做什么、全局接缝图与逐条接缝。每个包一个目录（内核应用、安装包），
另有开发（怎么跑、怎么测、怎么发版）、轨迹（怎么走到今天）与路线。站里的 `pnpm build` 只作提交前的检查；看页面由工作台托管开发服务：`docsite.site.add {"dir":"<站目录>"}`，地址以 `docsite.site.list` 回的 `url` 为准，不在会话里自己 `pnpm dev`。

这份 README 是生成物，正本是 `docs-site/content/docs/outputs/readme.mdx`。
