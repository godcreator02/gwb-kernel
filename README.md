# gwb-kernel

> **要在一台机器上装 gwb？** 见 [INSTALL.md](INSTALL.md)——写给替用户装机的 agent。安装包只带内核，件照那份说明装。

god 工作台的内核：一个 Electron 应用，cordis 住在主进程里，只做第一个件跑起来之前必须发生的事——铺 home、起 cordis 并挂件、
两半的裸名解析、开窗与桥、自己出错人看得见——其余一切皆件。件住在各自的件仓里，装进 home 由件管理件负责。

## 开发

```powershell
pnpm install
pnpm check                              # 构建词汇表 + typecheck + lint + test
$env:GWB_HOME = 'try-1'; cd apps\desktop; pnpm start   # 在隔离 home 里起本仓内核
```

日常使用从安装版起，不从仓里跑；安装包由 `installer/` 出。

## 文档

文档站在 `docs-site/`，从「从这里开始」读起：是什么、跟着一次开机走一遍、按来意怎么读。站上还有边界（只做什么、刻意不做什么）、
各模块的现状、轨迹（怎么走到今天）与路线。

```powershell
cd docs-site; pnpm build; pnpm start      # http://localhost:4314
```

这份 README 是生成物，正本是 `docs-site/content/outputs/readme.mdx`，改完在 `docs-site` 跑 `pnpm docfirst render` 重摆，一起提交。
