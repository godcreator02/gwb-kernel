# 条目的 fiber 什么时候变成 ACTIVE、`internal/status` 什么时候发

## 问什么

内核要在日志里记「哪个插件挂上了、花了多久、在等什么服务、失败在哪」，打算接 cordis 的 `internal/status` 事件。
动手前要确认：

1. 异步 `apply`（或 `Service` 子类的异步 `[Service.init]`）的条目，ACTIVE 是在 apply 开始时就设上，还是等它的 promise 完成？
2. 成功、同步抛错、异步 reject 各走哪几个状态？
3. `inject` 的服务还没到的条目，会不会发事件？服务到了之后呢？
4. `ctx.loader.await()` 等不等异步 apply、等不等永远 PENDING 的条目？
5. 插件里再 `ctx.plugin` 出来的子 fiber 也发事件吗？怎样把它和条目顶层的 fiber 区分开？
6. 包 import 失败时有没有 fiber、有没有事件、日志里有没有错误原文？
7. 停用、启用、改配置、删掉服务提供方再加回来，各走哪几个状态？

## 怎么跑

```powershell
npm ci
npm run probe > runs/01-timeline.txt
```

依赖见自带的 `package.json` 与 `package-lock.json`，钉在内核现役的三个版本：cordis 4.0.0-rc.10、
@cordisjs/plugin-loader 1.0.0-rc.7、@cordisjs/plugin-include 1.1.0。

`run.mjs` 是纯 node，不起 Electron，不碰任何 gwb home。它在系统临时目录新建一个 home（`probe-entry-state-*`，跑完不删），
装配照 `apps/desktop/src/main.ts`：`new Context()`、`ctx.baseUrl` 指向 home、`ctx.plugin(Loader, {})`、`ctx.loader.internal = { import }`、
`ctx.loader.builtins.include = Include`、`root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])`。
**和内核唯一的不同**是 include 的 config 多了 `enableLogs: true`，为了看 cordis 自己的 `apply plugin X` 记在哪一刻。

cordis.yml 九条，插件都在 `plugins.mjs`，包名由 `ctx.loader.internal.import` 按名字返回：

| 条目 | 插件做什么 |
| --- | --- |
| `sync` | 同步 apply，config `{ v: 1 }` |
| `async` | 异步 apply，等 300ms |
| `sync-fail` | apply 里同步抛错 |
| `async-fail` | 异步 apply，200ms 后 reject |
| `svc` | `Service` 子类，构造时 provide `probeSvc`，`[Service.init]` 等 400ms |
| `needs-svc` | `inject: ['probeSvc']` |
| `needs-nobody` | `inject: ['nobodyProvidesThis']`，没有任何插件提供 |
| `nested` | apply 里 `ctx.plugin` 一个异步子插件（等 100ms） |
| `missing` | 包名 `probe-not-installed`，import 时抛错 |

每一行输出前是从脚本开始算的毫秒数。记的是：每次 `internal/status`（fiber 名字、属于哪个条目、是条目顶层还是子 fiber、旧状态 → 新状态），
cordis logger 的全部输出（debug 起；第一个参数是 Error 时另打它的 `message` 和 stack 第一行），插件自己在关键时刻的打点。
启动加载之后依次：停用 `async`、启用 `async`、改 `sync` 的配置、删掉 `svc`、再加回一条 `probe-svc-async`。
停用、启用照插件管理的写法 `tree.update(id, { disabled: true })` / `{ disabled: null }`，`tree` 是 `ctx.loader.resolve('home').subtree`。

## 结论

**ACTIVE 等异步 apply 的 promise 完成才设上，LOADING → ACTIVE 的间隔就是 apply 的耗时；但「在等服务」没有任何事件，
import 失败的错误原文也进不了日志。**

1. **ACTIVE 的时机**：异步 apply 的条目 12ms 进 LOADING、apply 结束的 318ms 才进 ACTIVE（apply 等 300ms）；`Service` 子类的 `[Service.init]`
   一样，12ms → 427ms（init 等 400ms）。同步 apply 在同一轮里完成（12ms → 14ms）。源码上是 `Fiber._reload` 先 `await this._execute(...)`，
   之后才 `_updateState`（cordis `lib/index.js` 966–985）
2. **状态路径**：成功是 `PENDING → LOADING → ACTIVE`。失败不论同步抛错还是异步 reject，都是 `LOADING → UNLOADING → FAILED`，
   没有直接的 `LOADING → FAILED`。失败时 cordis 已经用插件自己的名字记了一条 error，带完整调用栈（`[error] [probe-sync-fail] Error: …`）
3. **等服务没有事件**：`needs-nobody` 全程一条 `internal/status` 都没有，状态一直是初始的 PENDING。`needs-svc` 在提供方 ACTIVE 的同一刻
   （427ms）才发出第一条 `PENDING → LOADING`。要知道「谁还在等、缺哪个服务」，只能在某一时刻扫一遍条目
4. **`ctx.loader.await()`** 等异步 apply、等服务链（提供方 init 完、依赖方再 apply）全部完成才返回（428ms），但不等永远 PENDING 的条目，
   也不因为有条目 FAILED 而抛出。所以在它之后扫一遍条目，得到的就是启动加载的最终结果（再等 800ms 状态不变）
5. **子 fiber**：`nested` 里 `ctx.plugin` 出来的 `probe-nested-child` 也发 `internal/status`，而且 `fiber.entry` 指向同一个条目 `nested`。
   区分用 loader 自己的判据：`fiber.parent.fiber?.entry !== fiber.entry` 的是条目顶层。`entry.fiber === fiber` 对所有 fiber 都是 false，不能用来判断
6. **import 失败**：条目没有 fiber，不发 `internal/status`；include 记一条 `[error] [include]`，但这个 Error 的 `stack` 已被换成只剩条目路径
   （`    at file:///…/#missing ⏎     at file:///…/#home`），第一行不再是 `Error: <原文>`。cordis 格式化 Error 用的是 stack，
   所以**日志里看不到错误原文**，原文只在 Error 的 `message` 里（`probe: 没有名为 probe-not-installed 的模块`）。另外之后每次改条目树，
   include 都重新 import 一次、再记一条同样的 error（这次改了 5 次，记了 5 条）
7. **`apply plugin X` 不等于挂上了**：`enableLogs` 打开后，`apply plugin X` 在 `registry.plugin` 之前记，等服务的条目也记
   （`needs-nobody` 记了 `apply plugin probe-needs-nobody`，却从来没有执行 apply）
8. **热更新**：

   | 操作 | 状态 |
   | --- | --- |
   | 停用 `async` | `ACTIVE → UNLOADING → DISPOSED` |
   | 启用 `async` | `PENDING → LOADING → ACTIVE`，ACTIVE 同样等 apply 的 300ms；`tree.update` 返回时 apply 还没完，`ctx.loader.await()` 等到了 ACTIVE |
   | 改 `sync` 的配置 | 同一个 fiber `ACTIVE → UNLOADING → LOADING → ACTIVE`，不经过 PENDING；cordis 记 `reload plugin probe-sync` |
   | 删掉 `svc` | 提供方 `ACTIVE → UNLOADING → DISPOSED`；依赖方 `needs-svc` `ACTIVE → UNLOADING → PENDING`（这一条有事件） |
   | 再加回 `probe-svc-async` | 新条目 `PENDING → LOADING → ACTIVE`（等 init 的 400ms），依赖方随即 `PENDING → LOADING → ACTIVE` |

本实验没有测试 loader 条目的 `isolate` 配置与 `group` 条目。

## 跑那次的环境

- 日期：2026-09-27
- 平台：Windows 11 Pro 10.0.26200，pwsh 7.6.6
- node v24.14.1，npm 11.11.0
- cordis 4.0.0-rc.10、@cordisjs/plugin-loader 1.0.0-rc.7、@cordisjs/plugin-include 1.1.0（与内核现役版本同号），cosmokit 1.8.1，js-yaml 4.3.2
- 被测对象：以上 npm 包版本（锁文件里带 integrity）
- 内核仓 HEAD：`0c5cb1511725daf4f2e8ca03e1ee11c579fbfa86`（2026-09-27）
- 本实验只借内核仓存放，不 import 仓里任何代码
