# 件退役 peer 之后，d.ts 里的跨件类型还解析得到吗

## 问什么

件把 peerDependencies 全部退役（运行时自己打包、清单只留 devDependencies）之后，bn-core 发布的 d.ts 里
`import type '@godcreator/gwb-plugin-api'`、`declare module 'cordis'` 和 `import '@godcreator/block-note'`，
在消费方 typecheck 时还能解析到真类型吗？还是会静默变成 any？这件事靠不靠 pnpm 的隐藏提升？

## 怎么跑

前提：pwsh 7、node ≥ 24、pnpm、npm；`@godcreator` scope 在用户级 `~/.npmrc` 指向 gitea 个人源，公共包走默认源。

```powershell
pwsh -File .\run.ps1        # 在本目录下跑；可加 -Work <短路径> 指定工作目录、-Only 01,04 只跑某几个情形
```

`prepare-vendor.ps1`（由 `run.ps1` 先调）从 registry `npm pack` bn-core 0.18.5 和 plugin-api 0.2.7，改清单后重新打成三份 tgz：

- `bn-core-nopeer`：peer 整份挪进 devDependencies。依赖方的 devDependencies 不会被装，这就模拟了「没有 peer」。
- `bn-core-optpeer`：peer 只留类型面引用的三个包（block-note、plugin-api、cordis），并全部标成 `peerDependenciesMeta.optional`。
- `plugin-api-nopeer`：plugin-api 自己的 peer（cordis）也挪进 devDependencies。

之后逐个情形做四件事：把 `ws/` 拷进工作目录、按情形改清单和 `hoist`、`pnpm install`、跑 `tsc` 与 `tsc --traceResolution`。
摘录写进 `runs/<编号>-<名字>.txt`。tgz、node_modules 和完整 trace 只落工作目录（默认在系统临时目录下），不进本目录。

`ws/plugins/consumer/src/probe.ts` 里埋了五处故意的类型错误（E1–E5），另有一行正确写法（OK 行，`ctx.effect`）：

- 某处 E 不报，说明那段类型静默变成了 any；
- OK 行报「属性不存在」，说明 cordis 的 Context 没接上。

tsconfig 照 gwb 各仓现行配置（bundler 解析，`skipLibCheck:true`）。

注意一个坑：工作目录要短。长目录名加上 `.pnpm` 的深路径会超过 Windows 的 260 字符上限，node 会读不到 typescript 的 package.json，报 `ERR_PACKAGE_IMPORT_NOT_DEFINED`（撞过）。

## 结论

**去掉 peer 以后，d.ts 里的外部包全靠 pnpm 默认的隐藏提升（`node_modules/.pnpm/node_modules`）解析；少列一个包，那段类型就静默变成 any。** 设了 `hoist:false`，消费方自己列齐也没用。能不依赖提升的只有两条路：在工作区根列出这些包；或者让 d.ts 链上的**每一个**包都把类型面引用写成可选 peer。

| # | 情形 | E4 `register(123)` | OK 行 `ctx.effect` | 解析落点 |
|---|---|---|---|---|
| 01 | 默认 hoist，consumer 列 bn-core / plugin-api / cordis | **不报（静默 any）** | 正确 | cordis、plugin-api 经 `.pnpm/node_modules`；block-note 解析不到。关掉 skipLibCheck 才露出 4 条 TS2307 |
| 02 | `hoist:false`，同 01 | 不报 | 误报 TS2339 | 三个包全都解析不到；E2 退化成「属性不存在」 |
| 03 | `hoist:false`，consumer 列齐四包 | 不报 | 误报 TS2339 | 同 02。consumer 的 node_modules 不在 `.pnpm/<bn-core>` 的祖先链上 |
| 04 | 默认 hoist，consumer 列齐四包 | 报 TS2345 | 正确 | 全部经 `.pnpm/node_modules` |
| 05 | `hoist:false`，工作区根 package.json 列三包 | 报 TS2345 | 正确 | 全部经 `<ws>/node_modules`（祖先目录） |
| 06 | `hoist:false`，bn-core 可选 peer，plugin-api 去 peer | 报 TS2345 | 误报 TS2339 | bn-core 这一层经兄弟链接解析到了；plugin-api 自己的 cordis 解析不到 |
| 07 | `hoist:false`，bn-core 可选 peer，plugin-api 原包（peer cordis） | 报 TS2345 | 正确 | 全部经各自 `.pnpm/<包>/node_modules` 下的兄弟链接，不靠提升 |

「全对」的标准是：恰好报 E1–E5 五处，OK 行不报。只有 04、05、07 达到。

## 跑那次的环境

- 日期：2026-09-23
- 平台：Windows 11 Pro 10.0.26200
- 工具：node v24.14.1、pnpm 12.4.2、npm 11.11.0、tsc 7.0.2（TypeScript 原生版）
- 被测包（registry 原包）：
  - `@godcreator/gwb-bn-core@0.18.5`：`sha512-WmcO2zW3Ow/b9CbCbB6yukRSySqVg/5frc1obT1CIxRCq+WDSDEhntDsiAYG6BePDy6cVvjChDP0ldwjyB9g5g==`
  - `@godcreator/gwb-plugin-api@0.2.7`：`sha512-PHqqy71X5jL6mziHVAWt7SRJJgioWlkZPXnv4CZFk2fV8BvuAgTcBGu2ekEqcYLoD7Ft+UcBcRZAizEuAVxxOQ==`
  - `cordis@4.0.0-rc.9`、`@godcreator/block-note@0.5.2`
- 本仓 HEAD：`546785a879750f9771f8003b2535dca9838da830`。plugin-api 0.2.7 的正本是本仓的 `packages/gwb-plugin-api`
- 版本锁定：清单里的顶层版本全部写死；没有随附锁文件，传递依赖（cosmokit、mdast 一族、react）按当时 registry 解析
