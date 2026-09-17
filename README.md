# gwb-kernel

god 工作台的正线：**最小的、能正常运行插件的那个版本**。

目标不是「内核行数最少」，是「能把插件正常跑起来」所需的最小集——后者带着一条验收
标准，插件得真能干活。

cordis 住 Electron 主进程（单进程）：整个应用只有主进程与渲染进程两个。母仓
`god-workbench` 已退役、只作参考；插件在插件仓 `26090709qzp/gwb-base-plugins` 重做。

## 内核只做六件事

|                  | 是什么                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------- |
| **铺 home**       | 建目录、缺什么补什么（`package.json`、空 `cordis.yml`），不覆盖                                         |
| **起 cordis**     | `Context` 的 `baseUrl` 指向 home，挂官方 loader 与 include；退出前 dispose loader 的 fiber 收走整棵插件树 |
| **解析裸名（node 半）** | 主进程没有 `--expose-internals`，给 `loader.internal` 塞五行按 home 解析                           |
| **解析裸名（浏览器半）**   | 扫 home 清单里各包声明的 `gwb.shared`，拼成 `file://` importmap 随外壳地址推给页面                         |
| **开窗与桥**         | 一扇窗；`gwb:command` 派给命令总线、`gwb:event` 推事件、`gwb:shell` 告诉页面外壳是谁                         |
| **页面根与错误出口**     | 页面听 `onShell` 加载外壳，没有外壳时画一份只读现状；日志全量进 stderr 加 `<home>/gwb.log`，出错只记不退                |

src 下六个文件合计 555 行（`main.ts` 305、`bare-import.ts` 29、`entry-state.ts` 40、
`imports.ts` 61、`index.html` 101、`preload.cjs` 19），外加词汇表 62 行——六个名字加一个
形状，正本在 `packages/gwb-plugin-api`。

准入判据两道关：**一、凡是「第一个插件存在之前必须发生的事」，才进内核，其余一律皆插件。
二、真遇到需求才加**——不是「将来可能要」，是某件事此刻就干不成，而且现场说得出来。
加功能的默认形态是加一个插件。插件跑在主进程里拿得到 `electron`：开窗、菜单、托盘、子进程
全是插件的事。

## 跑起来

```powershell
pnpm install
cd apps\desktop; pnpm build     # tsc 直出到 dist/，没有打包器
.\run.cmd                       # 落 default home（%APPDATA%\gwb-kernel\homes\default）
$env:GWB_HOME='x'; .\run.cmd    # 名字 → homes\x；给路径（含 \ 或 /）就用那个目录
pnpm check                      # build:api + typecheck + lint + test，提交前跑
```

home 是个普通的 npm 项目根。窗口起来时页面先说一句「没有外壳件」（`index.html` 里的原话）
——界面由插件交出。装插件两步：进 home `pnpm add`，`cordis.yml` 手写一条条目，重启。日志在
`<home>\gwb.log`，三路（插件 / 内核 / 渲染层 console）都在这一份里。

## 刻意不做的

不是还没做，是决定不做：装机入口（内核不碰 pnpm）、自动升级、盘上对账与失败还原、图形
界面上的失败兜底页、插件之间的准入核对、配置文件的模板与自愈；宿主子进程、日志管道、
`gwb://` 这类资源协议也随单进程重构刻意去掉了。每一条的理由都在文档站里写着；要做，
得先推翻上面那句准入判据。

## 文档

文档站在 `docs-site/`，用 fumadocs 起：

```powershell
pnpm --filter gwb-kernel-docs-site dev     # http://localhost:4314
```

**代码注释只写现状**——为什么这么写、撞过什么、判据怎么来的，全在文档站：机制页用
docfirst 钉在对应代码上，代码一改就报黄，得有人复核；[轨迹](/trajectory)一卡一
文件记定过的事与撞过的墙，是纯历史，不钉码。

`docfirst check` **不在 `pnpm check` 里**——它要起文档站的解析链，太慢，每次跑测试都带上
不值。单独两条 `pnpm doc` / `pnpm doc:confirm`，改了被钉住的代码就跑一次。

这份 README 是生成物，正本是 `docs-site/content/outputs/readme.mdx`，改完在 `docs-site` 跑
`pnpm docfirst render` 重摆，一起提交。
