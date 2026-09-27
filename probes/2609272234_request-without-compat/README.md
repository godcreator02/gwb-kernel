运行：`node D:/unitfolders/igldu-gwbkernel/gwb-lifecycle-plugins/plugins/devkit/bin/cdp.mjs request-channel-2609272140 eval ./probe.js`

## 问什么

删掉内核命令协议后，页面通用请求、commands 的错误回执和 shell 窗格是否仍能工作？

## 怎么跑

在本目录执行首行命令。需要启动装有本次配套插件的隔离 home；若 home 名不同，替换命令中的名称。CDP 工具来自 lifecycle 的 96d14ea，使用目标 home 自己的 commands 客户端。测试清单和发布版本分别在 runs/ 下保存。四个核心仓的完整检查命令均为仓根 `pnpm check`。

## 结论

页面 request 存在，command 不存在；缺失通道仍抛 Error，错误命令参数得到 commands 回执，shell.panes 成功。隔离 home 的 37 个条目全部 ACTIVE、没有 unmetPeers。kernel/base/UI/lifecycle 的测试分别通过 96、472、513、246 + 398 项；这些是当时整仓测试总数。

## 跑那次的环境

2026-09-27，Windows，Node 24.14.1。kernel f546a98、base e1fb6ca、UI cb497f8、lifecycle 4923f7e。隔离 home 为 request-channel-2609272140，运行从上述实现构建的开发包；正式发布 kernel 0.9.0 及 36 个配套插件。default 未切换到新内核。academic-deck 的 manifest 有并行改动，只提交迁移通知；UI 首页也有并行改动，留 inbox 跟进。
