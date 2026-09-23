# gwb-kernel

> **要在一台机器上安装 gwb？** 见 [INSTALL.md](INSTALL.md)——写给替用户安装的 agent。安装包只带内核，插件按那份说明安装。

god 工作台的内核：一个 Electron 应用，cordis 运行在主进程里，只做第一个插件运行之前必须完成的事——初始化 home、创建 cordis 实例并加载插件、
主进程与页面两侧的包名 import（bare specifier，直接写包名、不带相对路径的 import）解析、创建窗口与 IPC 通道、自身出错时让人看得见——其余功能全部由插件实现。
插件的源码在各自的仓里；只有插件管理插件 plugin-manager 放在本仓 `plugins/` 下，因为它依赖内核的内部约定，
安装、升级插件都由它负责。

## 开发

```powershell
pnpm install
pnpm check                              # 构建词汇表 + typecheck + lint + test
$env:GWB_HOME = 'try-1'; cd apps\desktop; pnpm start   # 在隔离 home 里启动本仓内核
```

日常使用从安装版启动，不从仓里运行；安装包由 `installer/` 生成。

## 文档

文档站在 `docs-site/`，从「从这里开始」读起：内核是什么、跟着一次启动走一遍、按你的目的该读哪些页。站上还有关键设计（只做什么、刻意不做什么）、
系统地图、五条接缝（其中一条是 home 与插件管理）、插件管理的分功能说明、关键判据、轨迹（怎么走到今天）与路线。

```powershell
cd docs-site; pnpm build; pnpm start      # http://localhost:4314
```

这份 README 是生成物，正本是 `docs-site/content/outputs/readme.mdx`；plugin-manager 包里的说明书 `SKILL.md` 也是，正本是 `docs-site/content/outputs/skills/gwb-plugin-manager.mdx`。改完在 `docs-site` 运行 `pnpm docfirst render` 重新生成，一起提交。
