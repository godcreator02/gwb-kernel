# 内核直接加载的内置插件，能不能拿到 cordis.yml 那棵条目树、照常改 cordis.yml

## 问什么

插件管理要改成内核内置：内核用 `ctx.plugin(…)` 直接加载它，它不再是 `cordis.yml` 里的一条条目。
它今天取条目树的办法是 `ctx.fiber.entry.parent.tree`（从自己那条条目往上找），不再是条目之后这条路就断了。
要确认：

1. 内核能不能从 loader 上直接取到承载 `cordis.yml` 的那棵树（include 实例），取得多早
2. 取到的和 `cordis.yml` 里的插件从自己条目上取到的是不是同一个对象
3. 内核经 config 把树交给直接加载的插件之后，这个插件能不能照常加条目、停用、启用、删条目，写回 `cordis.yml`
4. `cordis.yml` 被外部改动、include 重新读取之后，这棵树还是不是同一个对象

## 怎么跑

```powershell
npm ci
node run.mjs > runs/02-rerun.txt
```

依赖钉成内核现在用的版本（见 `package.json`）。`run.mjs` 照 `apps/desktop/src/main.ts` 的顺序搭环境：`new Context()`、
`ctx.plugin(Loader)`、`loader.internal.import` 按名字返回手写的小插件、`builtins.include = Include`、
`loader.root.update([{ id: 'home', name: 'cordis:include', … }])`。临时 home 建在系统临时目录，不碰任何 gwb home，
不启动 electron。每一步打印一行 JSON，原始输出在 `runs/01-baseline.txt`。

## 结论

1. **`ctx.loader.resolve('home').subtree` 就是那棵树**，`root.update` 返回时就已经有了（那时 include 条目还在 LOADING、树里还没有条目），
   是 `Include` 的实例。原因在 loader 源码：`EntryTree` 的构造函数里 `if (entry) entry.subtree = this`
   （`@cordisjs/plugin-loader` 1.0.0-rc.6 `lib/index.js` 第 147-152 行），include 构造时就把自己挂到了它那条条目上
2. 和 `cordis.yml` 里的插件经 `ctx.fiber.entry.parent.tree` 取到的**是同一个对象**
3. 内核用 `ctx.plugin(插件, { tree })` 把树传进去，插件拿到的就是这个对象；它自己的 `fiber.entry` 是 undefined（它不是条目）。
   用这棵树 `create` 一条新条目（返回完整 id `home:gamma`，状态 ACTIVE）、`update(id, { disabled: true })` 停用（DISPOSED）、
   `update(id, { disabled: null })` 启用（ACTIVE）、`remove(id)` 删除，每一步都写回了 `cordis.yml`，没有任何错误
4. 外部改写 `cordis.yml` 后调 `refresh()`，树还是同一个对象，新条目加载成功

对设计的影响：内核加载 include 之后，用 `ctx.loader.resolve('home').subtree` 取树，经 config 交给内置的插件管理；
插件管理不再需要「自己那条条目」，取树与取自己 id 的两个函数（`treeOf`、`ownEntryId`）可以删掉。
条目 id 的前缀 `home` 由内核决定，内核交出树时不需要插件管理知道它。

## 跑那次的环境

- 日期：2026-09-23
- 平台：Windows 11 Pro 10.0.26200，pwsh 7.6.6
- node v24.14.1，npm 11.11.0
- 被测对象：cordis 4.0.0-rc.9、@cordisjs/plugin-loader 1.0.0-rc.6、@cordisjs/plugin-include 1.0.5（与 `apps/desktop/package.json` 相同）
- 内核仓 HEAD：`4090ce5c7411190e3862951b9522ee8fc8a00e19`（2026-09-23）
- 本实验只借内核仓存放，不 import 仓里任何代码
