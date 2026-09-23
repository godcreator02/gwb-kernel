# 内置插件做成 loader 根层的条目：能不能被按条目认身份的服务认出、config 怎么传、和残留条目谁先

## 问什么

内核内置的命令插件与插件管理先是用 `ctx.plugin` 直接加载的。从源码启动内核实测发现：数据插件（`gwbData`）与说明书插件
（`gwbSkills`）都按调用方的条目认身份（`this.ctx.fiber.entry`），没有条目的内置插件调用它们直接报
「取不到调用方的身份——… 只能在经 cordis.yml 挂上的件里用」：插件管理的显示名读写失败，两个内置插件的说明书登记不上。

改成让内核把它们作为 **loader 根层的条目**加载（`ctx.loader.builtins` 登记模块，`root.update` 里和承载 `cordis.yml` 的
include 条目并列）之前，要确认：

1. 它们有没有条目、条目 id 是什么，按条目认身份的服务能不能认出
2. 条目的 config 怎么传到插件：字符串原样到吗，带方法的对象（比如条目树）会怎样
3. 插件管理排在 include 条目之前时，能不能拿到承载 `cordis.yml` 的那棵树、什么时候能拿到
4. 已有 home 的 `cordis.yml` 里残留同名条目时，谁先提供服务；两种排列顺序结果是否一样
5. 根层条目会不会被写进 `cordis.yml`

## 怎么跑

```powershell
npm ci
node run.mjs > runs/03-rerun.txt
$env:ORDER = 'after'; node run.mjs > runs/04-rerun-after.txt
```

依赖钉成内核现在用的版本（见 `package.json`）。纯 node，不启动 electron，临时 home 建在系统临时目录，不碰任何 gwb home。
`run.mjs` 照内核的做法搭环境，`cordis.yml` 里放四条：`cmd`、`pm`（提供与内置同名的服务，模拟升级前留下的旧条目）、`use-cmd`
（依赖 `gwbCommands`）、`plain`。内置的两个用手写的小插件代替，在 apply 里记下自己的条目 id，并用一个照数据插件写法的
`IdentityService` 认一次身份。默认顺序是 `commands`、`plugin-manager`、`home`；`ORDER=after` 时插件管理排在 `home` 之后。

原始输出：`runs/01-baseline.txt`（默认顺序）、`runs/02-plugin-manager-after-include.txt`（`ORDER=after`）。

## 结论

1. **有条目**：`fiber.entry.id` 分别是 `commands`、`plugin-manager`（根层条目没有 `home:` 前缀），按条目认身份的服务能认出。
   数据插件按条目 id 的末段分目录，插件管理的数据目录仍是原来作为 `cordis.yml` 条目时的 `plugin-manager`，已有的显示名不丢
2. **config 会被深拷贝**：字符串原样到达；带方法的对象到达时方法没了（`markerKeptMethod: false`）。原因在 loader 源码：
   条目的 config 经 `interpolate` 用 `valueMap` 逐层复制（`@cordisjs/plugin-loader` 1.0.0-rc.6 `lib/index.js` 第 253-263 行、第 331 行）。
   所以条目树不能经 config 传，只能传 include 条目的 id，由插件自己取
3. 插件管理排在 `home` 之前时，apply 那一刻 `ctx.fiber.entry.parent.tree.resolve('home').subtree` 还是 undefined
   （`treeAtApply: false`）；用到时再取，就是 include 那棵树（`lazyTreeIsIncludeTree: true`），用它加条目、删条目都写回了
   `cordis.yml`，新条目的完整 id 是 `home:gamma`
4. 两种顺序下，残留的 `cmd`、`pm` 都是 FAILED，`use-cmd` 拿到的是内置那份，`gwbCommands` / `gwbPluginManager` 都是内置那份；
   每条失败的残留条目各多一条 unhandledRejection（与 `probes/2609231919_duplicate-service-provider/` 相同）
5. 根层条目不会写进 `cordis.yml`（`rootEntriesInYml: false`）；`ctx.loader.entries()` 里能看到它们

对设计的影响：内核把两个内置插件作为 loader 根层条目、排在 `home` 之前加载；插件管理的 config 是 `{ home, pnpm }` 两个字符串，
条目树在用到时从自己条目所在那一层取。

## 跑那次的环境

- 日期：2026-09-23
- 平台：Windows 11 Pro 10.0.26200，pwsh 7.6.6
- node v24.14.1，npm 11.11.0
- 被测对象：cordis 4.0.0-rc.9、@cordisjs/plugin-loader 1.0.0-rc.6、@cordisjs/plugin-include 1.0.5（与 `apps/desktop/package.json` 相同）
- 内核仓 HEAD：`6acdb72`（2026-09-23）
- 本实验只借内核仓存放，不 import 仓里任何代码
