# 同一个服务名有两个提供方：内置那份与 cordis.yml 条目那份

## 问什么

计划把 `gwbCommands`、`gwbPluginManager` 两个插件改成内核内置：内核在加载 cordis.yml **之前**用
`ctx.plugin(内置插件)` 直接加载它们。已有 home 的 cordis.yml 里还留着这两个插件的条目（升级前装的旧版），
于是同一个服务名会有两个提供方。要回答：

1. 内置那份先 provide、cordis.yml 条目那份后 provide：抛错、告警、覆盖还是静默？条目最后是什么状态？
2. 另一个 cordis.yml 条目 `inject: ['gwbCommands']`，拿到的是哪一份？能不能正常加载？
3. 删掉重复条目（在条目树上 remove，或改 yml 让 include 重新读）之后：服务是不是内置那份？依赖方有没有被卸载再加载？
4. 顺序反过来（先 cordis.yml 条目、后内置）结果有没有不同？
5. 两份都用 `Service` 基类写（`super(ctx, 'gwbCommands')`）结果有没有不同？

## 怎么跑

```powershell
npm ci
npm run probe > runs/01-baseline.txt
npm run where-unhandled > runs/02-unhandled-origin.txt
```

依赖见自带的 `package.json` 与 `package-lock.json`，钉在内核现役的三个版本：cordis 4.0.0-rc.9、
@cordisjs/plugin-loader 1.0.0-rc.6、@cordisjs/plugin-include 1.0.5。npm 安装没有报 peer 冲突，
所以不需要 `.npmrc`。

- `run.mjs`：纯 node，不起 Electron，不碰任何 gwb home。每个场景在系统临时目录新建一个 home
  （`probe-dup-svc-*`，跑完不删），写一份 cordis.yml，装配照 `apps/desktop/src/main.ts`：
  `new Context()`、`ctx.baseUrl` 指向 home、`ctx.plugin(Loader, {})`、`ctx.loader.internal = { import }`、
  `ctx.loader.builtins.include = Include`、`ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])`。
  cordis.yml 有四条：`cmd`（`@godcreator/gwb-commands`）、`pm`（`@godcreator/gwb-plugin-manager`）、
  `use-cmd`（inject `gwbCommands`）、`use-pm`（inject `gwbPluginManager`）。包名由 `ctx.loader.internal.import`
  按名字返回 `plugins/` 里手写的插件。
  - 两种提供方写法（`plugins/providers.mjs`）：`fn` 照 `plugins/commands` 的 apply，
    `ctx.effect(() => ctx.provide(name, value))`；`class` 是 `class extends Service { constructor(ctx) { super(ctx, name) } }`
  - 内置与 cordis.yml 两份是两个不同的插件对象（各自的 apply / 类），对应实际情况：一份打进内核，一份从 home 的 node_modules 解析
  - 服务值上带 `source: 'builtin' | 'yml'` 用来区分是哪一份；`gwbPluginManager` 的值是 `{ contract: 1, source }`
  - 三个场景 × 两种写法：内置先 + 条目树 remove；内置先 + 改 yml 再 `refresh()`；yml 先 + 内置后
  - 每一步打印：内置两个 fiber 的状态、四条条目的 fiber 状态、`ctx.get` 取到的服务值与提供它的 fiber、
    各插件 apply / 构造 / 卸载次数、依赖方每次加载时看到的是哪一份、这一步里 cordis logger 的全部输出（debug 起）
    与 unhandledRejection。堆栈每条只留前 8 行
- `where-unhandled.mjs`：给 `Fiber.prototype.await` 返回的 promise 记下调用处，原样再跑一遍 `run.mjs`，
  只打印每条 unhandledRejection 是谁调用的 `fiber.await()` 留下的

## 结论

**同名服务第二个 provide 一律抛错，不覆盖、不静默。先 provide 的那份一直有效；后来的那个插件 fiber 进入 FAILED，
之后不会自己重试。依赖方拿到的始终是先 provide 的那份，删掉失败的那一方时依赖方不会被卸载再加载。两种写法结果一致。**

### 1. 内置先、cordis.yml 条目后

- 条目 `cmd` / `pm` 的 fiber 是 `FAILED`，`_error` 是
  `service "gwbCommands" has been registered at <builtin-commands>`（`gwbPluginManager` 同样）
- cordis logger 一条 error，名字是后来那个插件的名字：
  `[error] [yml-commands] Error: service "gwbCommands" has been registered at <builtin-commands>`，
  堆栈顶是 `cordis/lib/index.js:1158:15`
- 另外每条失败条目各有一条 `unhandledRejection`，内容是同一个 Error。调用处是
  `@cordisjs/plugin-loader/lib/index.js:388`（`_Entry.init` 里的 `this.fiber?.await().finally(...)`），见 `runs/02-unhandled-origin.txt`
- `fn` 写法里失败那份的 apply 执行了（计数 1），但 provide 后面那行 info 没有打出来；`class` 写法里构造函数执行了（计数 1）
- `ctx.get('gwbCommands')` 取到 `builtin`，提供它的 fiber 是 `builtin-commands:ACTIVE`；内置两个 fiber 始终 `ACTIVE`
- `ctx.loader.await()` 正常返回，不因为有条目失败而抛出

### 2. cordis.yml 里 inject 这个服务的插件

`use-cmd` / `use-pm` 正常加载（`ACTIVE`，apply 1 次），看到的是 `use-commands←builtin | use-plugin-manager←builtin`。

### 3. 删掉重复条目之后

| 删法 | 结果 |
| --- | --- |
| `ctx.loader.remove('home:cmd')`（loader 根树上、带前缀的 id） | **什么都没发生**：不报错、条目仍是 FAILED、cordis.yml 内容不变 |
| `ctx.loader.resolve('home').subtree.remove('cmd')`（include 那棵树上、不带前缀的 id，plugin-manager 用的就是这个） | 条目删掉，cordis.yml 里 `cmd` / `pm` 两条被写掉 |
| 改写 cordis.yml 去掉两条，再调 include 实例的 `refresh()` | 条目删掉 |

后两种删法之后：服务仍是 `builtin`（本来就一直是它），`use-commands.apply` 仍是 1、没有 dispose 计数——
依赖方没有被卸载再加载，日志无输出。include 1.0.5 的源码里没有监视文件，改了 yml 要调 `refresh()` 才会重新读。

### 4. 顺序反过来：cordis.yml 条目先、内置后

- 条目那份 `ACTIVE`、提供服务，依赖方看到 `yml`
- 内置两份 `ctx.plugin` 之后 `FAILED`，`await ctx.plugin(内置)` **抛出**
  `service "gwbCommands" has been registered at <yml-commands>`；logger 里 `[error] [builtin-commands] ...`；
  这里没有 unhandledRejection（因为调用方 await 了）
- 删掉条目 `cmd` / `pm` 之后：服务没有了（`ctx.get` 为 `undefined`），依赖方各卸载 1 次、回到 `PENDING`；
  **内置那份仍是 FAILED，不会自己补上**
- 把 FAILED 的内置 fiber `dispose()`、再 `ctx.plugin` 一次：内置 `ACTIVE`，依赖方各重新加载 1 次（apply 计数 2），看到 `builtin`

### 5. Service 基类写法

四个问题的结果与函数写法完全相同。唯一区别是抛错的调用链：从 `Service` 构造函数（`cordis/lib/index.js:1450`）
进 `provide`，再在 1158 行抛出；插件自己的构造函数已经执行到 `super(...)`。

### 源码里决定这些行为的行

`cordis@4.0.0-rc.9 lib/index.js`：

- **1146–1171 `provide`**：整段包在 `this.ctx.fiber.effect(...)` 里。1154 在根上下文上给服务名取一个 Symbol 作键（`??=`，只取一次），
  1155 按当前上下文取这个键；**1157–1158：这个键下已经有实现就 `throw new Error(\`service "${name}" has been registered at <${this.store[key].fiber.name}>\`)`**，
  尖括号里是已有那份所在 fiber 的名字（插件的 `name`）。没有替换、没有排队，所以不会覆盖
- 1160–1163：通过检查才写进 `store`，并且只有当前 fiber 已经 ACTIVE 时才 `notify`；抛错的那次没有写入，也就没有通知任何依赖方——
  所以依赖方不会被卸载再加载
- 1165–1170：撤销时删掉 `store` 里这个键并 `notify`。失败的那份没有写入过，删掉它的条目不会动到先来那份的实现
- 1450：`Service` 构造函数里调用的就是 `ctx.reflect.provide(name, self, ...)`，所以两种写法走同一段检查
- 844–880 `effect`：执行时同步抛出就先撤销已收集的副作用再抛（877–879），错误一路抛出 apply / 构造函数
- 961–971 `_reload`：插件执行抛错时 `this.ctx.logger.error(reason)`（968）——就是日志里那条 error——并记下 `this._error`；
  903：有 `_error` 的 fiber 状态就是 FAILED
- 945–948 `_setEpoch`：有 `_error` 直接返回。依赖满足与否的变化都走这里，所以 FAILED 的 fiber 在服务腾出来之后也不会重新执行
- 1003–1008 `await()`：有 `_error` 就抛出；1372–1373 `ctx.plugin` 返回值的 `then` 就是 `fiber.await()`，所以 `await ctx.plugin(...)` 会抛
- 1127–1133 `_getImpl`：`ctx.get` 只认 fiber 为 ACTIVE 的实现

`@cordisjs/plugin-loader@1.0.0-rc.6 lib/index.js`：

- 388 `_Entry.init`：`this.fiber?.await().finally(...)` 没有 catch，fiber 失败时产生 unhandledRejection（`where-unhandled.mjs` 实测调用处就是这一行）
- 99–101 `EntryGroup.update`：创建条目时的错误被 catch 后写日志，所以 `root.update` 与 `ctx.loader.await()` 不抛
- 81–90 `EntryGroup.remove`：用 `this.tree.store[id]` 找条目，找不到就直接返回；205–209 `EntryTree.remove` 把完整 id 原样传下去。
  include 那棵树的 `store` 键是不带前缀的 `cmd`，所以 `ctx.loader.remove('home:cmd')` 不报错也不生效

`@cordisjs/plugin-include@1.0.5 lib/index.js`：156–159 `refresh()` 重新读文件、有变化就 `root.update`；全文没有文件监视。

本实验没有测试 loader 条目的 `isolate` 配置。

## 跑那次的环境

- 日期：2026-09-23
- 平台：Windows 11 Pro 10.0.26200，pwsh 7.6.6
- node v24.14.1，npm 11.11.0
- cordis 4.0.0-rc.9、@cordisjs/plugin-loader 1.0.0-rc.6、@cordisjs/plugin-include 1.0.5（与内核现役版本同号），cosmokit 1.8.1，js-yaml 4.3.2
- 被测对象：以上 npm 包版本（锁文件里带 integrity）
- 内核仓 HEAD：`981396f70fd0f5ec8af23b64e725220ef44105ea`（2026-09-23）
- 本实验只借内核仓存放，不 import 仓里任何代码
