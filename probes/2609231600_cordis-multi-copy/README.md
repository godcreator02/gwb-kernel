# 件用自己那份 cordis（另装一份 / 打进束），挂到宿主的 cordis 上还能不能正常 provide / inject

## 问什么

宿主（内核）用 cordis 4.0.0-rc.9 `new Context()`。**件如果 `extends Service` 用的是另一份 cordis**
（另一个版本、另一个模块实例，或被 esbuild 整份打进件的束），服务能不能 provide、别的件能不能
inject 到、provider 重挂时依赖方能不能被拆掉再挂回、dispose 干不干净？顺带问：**完全不按值
import cordis**（`ctx.provide` + `Symbol.for('cordis.tracker')`）能不能写出同样联动的服务？

起因是 devkit 写插件手册的红线 2（「cordis 写在 dependencies 就有第二份实例，Service 身份对不上、
挂不上」），以及 default home 里件解析到的是 home 自己的 rc.10、与内核那份 rc.9 不是同一份，却一切正常。

## 怎么跑

```powershell
npm ci
npm run probe > runs/02-rerun.txt
```

依赖见自带的 `package.json` 与 `package-lock.json`（全部走 npmjs 公共源）。`.npmrc` 里的
`legacy-peer-deps=true` 必须有：cordis rc.10 把 plugin-loader `^1.0.0-rc.7` 声明成 peerOptional，
与这里钉的 rc.6（内核现役那版）冲突，不开的话 `npm ci` 会报 ERESOLVE。

`npm run probe` 就是 `node gen.mjs && node run.mjs`：

- `gen.mjs`：从 `src/*.template.mjs` 生成变体，全部落进 `dist/`（生成物，被仓的 `.gitignore` 忽略，不入库）
  - `*-host.mjs` import `cordis`，和宿主是同一份 rc.9
  - `*-b.mjs` import `cordis10`（npm alias），是另一份 rc.10
  - `*-bundled{10,9}.mjs` 由 esbuild 把 cordis（连同 cosmokit）整份内联，产物零裸名 import
- `run.mjs`：纯 node，不起 Electron，不碰任何 gwb home。宿主是 `node_modules/cordis`（rc.9）。
  链是 counter ← consumer（函数写法），加 counter ← viewer（类写法，inject counter 又 provide viewer）← leaf。
  每个场景依次做：先挂三个依赖方 → 挂 provider → 撤 provider → 挂回 → 全部撤掉。
  直接 `ctx.plugin` 跑 6 组，走 `@cordisjs/plugin-loader` 的条目 create / disabled / remove 再跑 3 组。
  宿主 logger 的 error / warn 与 unhandledRejection 全收进 `errors` 一行

手写的件在 `plugins/`，其中 `provider-fn.mjs` 就是不按值 import cordis 的最小写法。

## 结论

**跨份没有问题：provider 与 viewer 用另一份 rc.10、或 esbuild 打进束的 rc.10 / rc.9 时，
9 组场景全部 provide / inject 成功，provider 撤下时三个依赖方各拆 1 次、退回 PENDING，
挂回时各重挂 1 次（apply / ctor 计数 1→2），全部撤掉后 `registryDelta=0`、服务表为空，
`errors: none`；服务方法里的 `this.ctx` 都是消费者自己（`callerMatch=true`）。唯一的差异是
`svc instanceof 宿主 Service` 跨份为 `false`。**

原因在源码（`cordis@4.0.0-rc.9 lib/index.js`）：

- `Service` 构造时调用的是宿主 ctx 的 `ctx.reflect.provide`（:1450），服务表、fiber、registry
  都住在宿主实例上
- 协议符号全部是 `Symbol.for("cordis.*")`（:44-63）
- 宿主判断插件只看是不是构造器（:714），核心里没有 `instanceof Service/Context`

唯一身份敏感的是 `Service[Symbol.hasInstance]`（:1494），只有自己写 `instanceof Service` 才会撞上。
rc.9 与 rc.10 的差异在 traceable / waterfall，`Service` 类那一段逐字相同。

不按值 import 的写法在直接挂载和走 loader 两种方式下都联动成功，写法如下：

```js
ctx.provide('counter', {
  [Symbol.for('cordis.tracker')]: { associate: 'counter', property: 'ctx' },
  hit() { /* 这里的 this.ctx 就是消费者 */ },
})
```

对照组不挂 tracker，同样能联动，但方法里拿不到消费者（`callerMatch=false`）。

打进束的代价是每个件约 54 KB。原始输出见 `runs/01-baseline.txt`。

## 跑那次的环境

- 日期：2026-09-23
- 平台：Windows 11 Pro 10.0.26200，pwsh 7.6.6
- node v24.14.1，npm 11.11.0
- cordis 4.0.0-rc.9（宿主，与内核打进 app.asar 的同号）
- cordis 4.0.0-rc.10（npm alias `cordis10`，与 default home 经 peer 自动装的同号）
- @cordisjs/plugin-loader 1.0.0-rc.6，esbuild 0.28.2，cosmokit 1.8.1（两份 cordis 共用这一份）
- 被测对象：以上 npm 包版本（锁文件里带 integrity）
- 内核仓 HEAD：`546785a879750f9771f8003b2535dca9838da830`（2026-09-23）
- 本探针只借内核仓落盘，不 import 仓里任何代码
