# peer 依赖 + 现查路径，能不能做到「包升级了、进程不重启就读到新的」

## 问什么

今天的形状：gwb 的件把一个会独立分发的 npm 包写进自己的 `dependencies`，用
`import.meta.resolve` 算出它的路径，去读它的文件、起它的可执行；**从不 import 它的代码**。
病在于包升级之后件手里攥着首次解析出的旧真实路径（pnpm 下带版本号、旧目录还在盘上），
于是读到旧文件，全程零报错，只能重启工作台。

提议的新形状：那个包从 `dependencies` 降成 `peerDependencies`，件不再走模块解析，
改成每次现查 `<home>/node_modules/<包名>`（一条指向当前版本的软链）。

**这个方案的命门是 peer 由谁装、由谁升。** 这次实验就问这一件事，拆成六问：本机 pnpm 的
peer 设置是什么、`pnpm add` 一个有 peer 的包会不会把 peer 自动装进来、装成什么形态、
`<home>/node_modules/<包名>` 这条路径存不存在、升级怎么走、以及**一个活着的进程不重启
能不能读到新内容**。

## 怎么跑

```powershell
node probe.mjs final
```

零 npm 依赖，只用 Node 内置的东西。外部只要两样：**本机 Verdaccio 在 4873 上跑着**
（`npm ping --registry http://127.0.0.1:4873/`；起法见 `D:\unitfolders\26090520zzv\registry.ps1`）、
`pnpm` 在 PATH 上。位置参数是落进 `runs/` 的文件标签（默认 `run`），`--keep` 保留临时工作目录。

脚本自己造五对假包发到本机 registry、在 `%TEMP%\gwb-probe-peer\work\` 下各开一个隔离 home、
跑完把假包从 registry 上 unpublish 掉并删掉工作目录。**全程不碰 default home**，
也不碰任何真件。

> 假包只能叫 `@godcreator02/probe-peer-*`：registry 的 `config.yaml` 里只有
> `@godcreator02/*` 允许 publish / unpublish，`@probe/*` 会被当成公网代理包拒掉。
> 另外 `npm publish` 走不通（ENEEDAUTH），`pnpm publish` 匿名可以——脚本用的是后者。

五个场景，每个用自己的一对包名（`-a` `-b` …），互不污染：

| 场景 | 库写在件的哪 | home 设置 | 装了什么 |
| --- | --- | --- | --- |
| a | `peerDependencies` | 默认 | 只 `pnpm add` 那个件 |
| b | `peerDependencies` | 默认 | 件与库**一起**装进 home |
| c | `dependencies`（今天的形状） | 默认 | 只 `pnpm add` 那个件 |
| d | `peerDependencies` | home `.npmrc` 写 `auto-install-peers=false` | 只装件 |
| e | `peerDependencies` | home `pnpm-workspace.yaml` 写 `autoInstallPeers: false` | 只装件 |

每个场景里都有一个**长跑 Node 进程**（`fixtures/watcher.mjs`）：起来时 import 一次假件，
之后再也不 import 任何东西，只按口令打快照。库发新版本、跑升级命令，全发生在它活着的时候。
每张快照并排量五样：

1. 现查 `<home>/node_modules/<包名>/marker.txt`（**提议的新形状**）
2. 攥着首次 `import.meta.resolve` 出来的 URL 去读（**今天件的做法**）
3. 同一个进程里再算一次 `import.meta.resolve`
4. 同一个进程里再算一次 `createRequire().resolve`
5. **新起一个进程**算一次 `import.meta.resolve`——这一栏是磁盘的地面真相，
   它跟 2/3 的差就是进程内缓存

## 结论

**第 5 条通。** 一个活着的 Node 进程，在包升级之后不重启、不重新 import 任何模块，
重新读一次 `<home>/node_modules/<包名>/<文件>` **读到的是新内容**——前提是那个包
**在 home 的 `package.json` 里是一条直接依赖**，升级动作是 `pnpm add <包>@<新版本>`。
靠 pnpm 自动补 peer 那条省事的路**不通**：路径根本不存在。

六问逐条：

**一、这台机器上 pnpm 的 peer 设置：没设过，走默认（= 自动装）。** `pnpm --version` 是
**11.21.0**，`pnpm config get auto-install-peers` 回 **`undefined`**。用户级 `~/.npmrc` 只有
两行（`@godcreator02:registry` 与公网 authToken），没有这个键。**16 个真 home 一个都没有
`pnpm-workspace.yaml`**，`.npmrc` 有的那几个也只写了一行 scope registry。另外内核仓根的
`pnpm-workspace.yaml` 现在也没有 `autoInstallPeers`（仓 `AGENTS.md`「撞过的墙」里那条已经
是史料，不是现状）。

顺带测出这个键**在 pnpm 11 上换地方了**：写进 home 的 `.npmrc` 完全不起作用（场景 d 的
行为跟默认场景 a 一模一样），写进 `pnpm-workspace.yaml` 才认（场景 e 的 peer 一个字节都
没装）。所以「往 home 的 .npmrc 里塞一行」这条路是死的。

**二、`pnpm add` 一个有 peer 的包，peer 会被自动装进来——但不是装成 home 的直接依赖。**
场景 a 里 `pnpm add @godcreator02/probe-peer-plugin-a@0.1.0` 之后：

```
home/package.json  { "dependencies": { "@godcreator02/probe-peer-plugin-a": "0.1.0" } }   ← 库不在里面
.pnpm/ 里的相关目录  @godcreator02+probe-peer-lib-a@0.1.0,
                     @godcreator02+probe-peer-pl_c0393c26f3ebfe80d7adb736c597214e
  件私有 .../node_modules/ 里有: probe-peer-lib-a, probe-peer-plugin-a
```

也就是说：库被拉进虚拟仓 `.pnpm/`，并且**只**软链进那个件自己的私有 `node_modules/`。
home 的 `package.json` 里没有它；锁文件里它以「件的 peer 解析结果」的形式出现
（`version: 0.1.0(@godcreator02/probe-peer-lib-a@0.1.0)`），件的虚拟仓目录名也因此带上了
peer 哈希后缀。

**三、`<home>/node_modules/<peer 包名>` 这条路径——自动装的情况下不存在。**

| 场景 | 这条路径 | 形态 |
| --- | --- | --- |
| a（只装件，peer 自动补） | **不存在**（ENOENT） | — |
| b（件与库一起装） | **存在** | symlink/junction → `<home>/node_modules/.pnpm/@godcreator02+probe-peer-lib-b@0.1.0/node_modules/@godcreator02/probe-peer-lib-b` |
| c（今天的形状，只装件） | **不存在** | — |
| d（.npmrc 关 auto-install-peers） | **不存在** | — |
| e（workspace.yaml 关 autoInstallPeers） | **不存在**，而且库根本没装，件连解析都解析不到（`ERR_MODULE_NOT_FOUND`） | — |

**只有把包写进 home 的 `package.json` 才有这条路径**；写进去了它就是一条指向
`.pnpm/<包名>@<版本>/…` 的 junction，`readlink` 里带着版本号——所以「换版本 = 换 junction 指向」，
这正是方案要的那个支点。

**四、升级：`pnpm update` 一路都不好使，唯一好使的是 `pnpm add <包>@<新版本>`。**

- （a）`pnpm update <包>`：场景 a、b、d 全部回 **`Already up to date`**，磁盘一个字节没动。
  场景 a 是因为包压根不在 `package.json` 里；场景 b 是因为 `pnpm add x@0.1.0` 写进去的是
  **精确版本** `"0.1.0"`，`pnpm update` 尊重这个范围，于是它「已经是最新的了」。
  真 home 里每一条依赖都是这样的精确版本（`"@godcreator02/gwb-shell": "0.2.4"`），
  所以这条结论对真 home 也成立。
- （b）peer 没进 `package.json` 时，`pnpm update <包>` / `pnpm update` / `pnpm install`
  **三条命令都碰不到它**（场景 a 连跑三条，`.pnpm/` 里始终只有 `lib-a@0.1.0` 一个目录）。
  这一条对 gwb 有直接后果：`plugins.outdated` 走的是 `pnpm outdated`，只看 home 的
  `package.json`；`plugins.update-all` 走的是「`outdated()` 拿清单 → 一趟
  `pnpm add a@x b@y`」。**自动补进来的 peer 永远不会出现在那份清单里，一键热升也就永远
  升不到它。**
- （c）`pnpm add <包>@0.1.1` 之后 `<home>/node_modules/<包名>` 的指向**变了**：
  `…lib-b@0.1.0\…` → `…lib-b@0.1.1\…`，读出来 `marker=new`、`version=0.1.1`。
  同时 pnpm 会为件建一个**新的**虚拟仓目录（peer 哈希变了），旧的那个仍留在盘上、
  仍指着旧版本的库——旧目录不清理，这正是今天那个病的土壤。

**五、最终验收：通。** 场景 b 的长跑进程，从起来到最后一直没退过、没重新 import 过任何模块：

| 动作 | ① 现查路径 | ② 攥着的 URL | ③ 同进程再 resolve | ⑤ 新进程 resolve |
| --- | --- | --- | --- | --- |
| （升级前） | old (v0.1.0) | old | old | old |
| `pnpm update <lib>` | old (v0.1.0) | old | old | old |
| `pnpm update` | old (v0.1.0) | old | old | old |
| **`pnpm add <lib>@0.1.1`** | **new (v0.1.1)** | old | old | new |

一句话说死：**只要那个包是 home 的直接依赖、升级走 `pnpm add <包>@<新版本>`，
活着的进程重新读一次 `<home>/node_modules/<包名>/<文件>` 就读到新内容，不用重启、
不用重挂、那个包也确实从没进过 Node 的模块图。**

**六、对照：`import.meta.resolve` 在同一个进程里是有缓存的，第二次算还是旧路径。**
最干净的证据在场景 c（今天的形状）：

| 动作 | ② 攥着的 URL | ③ 同进程再 resolve | ⑤ 新进程 resolve | 磁盘上件私有链接 |
| --- | --- | --- | --- | --- |
| （升级前） | old | old | old | → `lib-c@0.1.0` |
| `pnpm update <lib>` | old | old | **new** | → **`lib-c@0.1.1`** |
| `pnpm update` | old | old | new | → `lib-c@0.1.1` |
| `pnpm install` | old | old | new | → `lib-c@0.1.1` |

磁盘已经翻到 0.1.1（新起的进程解析出来就是 new，件私有 junction 也改指了），
**同一个老进程里再算一次 `import.meta.resolve` 拿到的仍然是旧 URL**，`createRequire().resolve`
同样。「跟首次同一个 URL？」这一栏五个场景十七次快照**全是「是」**。

为什么读到的是旧内容而不是报错：`import.meta.resolve` 返回的是**解开软链之后的真实路径**
（`…/.pnpm/@godcreator02+probe-peer-lib-c@0.1.0/node_modules/…`，URL 里带着版本号），
而 pnpm **不删旧版本目录**——旧文件原样躺在盘上，读它一路成功，零报错。
这就是「全程零报错、只能重启」的完整机制。

**所以两条做法的差别不在「缓存清不清得掉」，在取址方式：** 现查
`<home>/node_modules/<包名>` 拿到的是一条**会被 pnpm 改指的 junction**，指向永远是当前版本；
`import.meta.resolve` 拿到的是**一次性解开的、带版本号的真实路径**，解开那一刻就定死了。

### 卡在哪：peer 由谁装，三条路各自的代价

方案成不成立，取决于怎么保证那个包出现在 home 的 `package.json` 里。三条路，
**这里只摆代价，不替谁拍板**：

- **`plugins.install` 装件时顺带把 peer 也装进 home。** 效果最正：进了
  `package.json`，`plugins.outdated` 看得见，`plugins.update-all` 一键热升能升到它。
  代价是 `gwb-plugins` 件要多一段逻辑（读装完那个包的 `peerDependencies`、挑出该装的、
  再 `pnpm add` 一次），并且要想清楚「卸件时这条 peer 谁来收」——多个件 peer 同一个包，
  卸掉一个不能把它带走。
- **home 开 auto-install-peers。** 这条路这次实测**走不通**：默认本来就是开的
  （场景 a 就是默认行为），开着也只把包塞进 `.pnpm/`，`<home>/node_modules/<包名>`
  照样不存在，`pnpm outdated` 照样看不见。这个开关解决不了本方案的问题。
- **人手装。** 零改动、当场可用，代价是「装了件却没装库」这种半截状态没有任何东西拦得住，
  件在运行时才发现路径不存在——而且升级也得人记着手动来一趟。

另外两条不算「路」、但要一并知道的事实：升级动作只能是 `pnpm add <包>@<精确版本>`
（`pnpm update` 对精确版本的依赖是空操作）；`pnpm add` 一次会顺手为件重建一个新的虚拟仓
目录，**旧目录不清理**，所以任何还攥着旧真实路径的东西都会继续静默读到旧文件。

## 跑那次的环境

- 日期：2026-09-10
- 平台：win32/x64，Windows 11 Pro 10.0.26200，pwsh 7
- 运行时：Node **v24.14.1**，**pnpm 11.21.0**
- registry：本机 Verdaccio，`http://127.0.0.1:4873/`（`config.yaml` 只给 `@godcreator02/*`
  开 publish/unpublish）
- 被测对象：量的是 pnpm 与 Node 自己的行为，不是内核代码；跑的时候 `gwb-kernel` 在
  commit **`341f5f1`**，工作区除本目录外无改动
- **假包已清干净**：五对共十个包全部 `pnpm unpublish --force` 掉，收尾时
  `npm search probe-peer --registry http://127.0.0.1:4873/` 回 `[]`（见 `runs/03-final.txt` 末尾）。
  临时工作目录 `%TEMP%\gwb-probe-peer\work\` 也已删。真的留了残骸的话，清法是
  `pnpm unpublish @godcreator02/probe-peer-lib-<a..e> --force --registry http://127.0.0.1:4873/`
  与同名的 `probe-peer-plugin-<a..e>`。

`runs/` 里三次：

| 文件 | 跑的是什么 | 那时的 `probe.mjs` |
| --- | --- | --- |
| `01-baseline.txt` | 头一趟，两个场景 | 初版：五个场景共用**同一对**包名，于是第二个场景开始装的时候 registry 上已经有 0.1.1 了——它的「升级前」快照读到的就是 new，**这一趟的场景 B 整段作废**。留着是因为它是「场景之间会互相污染」这个坑的现场，也是这个脚本改成一场一对包名的理由 |
| `02-five-scenarios.txt` | 五个场景，每场一对包名 | 第二版。结论表跟 03 逐格一致 |
| `03-final.txt` | 五个场景，复现 02 | 现在这版：多打了件私有 `node_modules/` 里的链接指向（`.pnpm` 会把过长目录名截断成 `…+probe-peer-pl_<hash>`，第二版按整包名筛所以一条都没筛到） |

02 与 03 的总表逐格相同，读哪一份都一样；02 唯一缺的是「件私有链接指向哪」那几行，
而结论六里「磁盘真的翻到 0.1.1 了」这一条正是靠那几行钉死的。
