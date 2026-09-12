# 退出收尾：dispose() 等不等嵌套的异步收尾

**问什么**：app 退出时内核 dispose loader 的 fiber，cordis 的 `dispose()` 返回的 promise
到底包不包嵌套的异步收尾（件杀子进程那种）？不包的话怎么等？

**怎么跑**（在仓根）：

```
node probes/2609121712_quit-dispose-await/probe.mjs dispose-only
node probes/2609121712_quit-dispose-await/probe.mjs dispose-await
```

三层插件链，最深层收尾返回 300ms 的 promise；两个模式各打一行总耗时。
真机复现（隔离 home 起站 → 关窗 → 看 `<home>/gwb.log` 与端口/进程）没法一行跑，
步骤与原始记录在 runs/04、05 里。

**结论**：合成链上 dispose-only 与 dispose+await 都等（~310ms，runs/01、02、03——
**阴性结果**，合成环境复现不出真机故障）；真机上（Electron + 真实件树）dispose-only
的 promise 约 4ms 就 resolve、件收尾没有跑（runs/04），补一句 `fiber.await()` 之后
整棵树拆完才退（634ms，runs/05）。修复两半缺一不可：内核 dispose 后 await，件把
真收尾**返回**出来（站件同日修）。

**跑那次的环境**：2026-09-12，Windows 10 (26200)，Node 24.14.1 / Electron（内核
repo `apps/desktop` 构建），cordis 4.0.0-rc.9；内核仓 commit `40c76d7`（修复后），
失败轮对应 `9241f91`（dispose-only）。
