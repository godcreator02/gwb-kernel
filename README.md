# gwb-kernel

god 工作台的正线：**最小的、能正常运行插件的那个版本**。

目标不是「内核行数最少」，是「能把插件正常跑起来」所需的最小集——后者带着一条验收
标准，插件得真能干活。

母仓 `god-workbench` 与它的件仓 `gwb-plugins` 准备废弃，此后只作参考；插件（这里叫
**件**）全部重做一份。母仓走到今天约 5100 行，其中约 3600 行服务于同一件事——让失败
变得体面（自动升级的四路判定、盘上对账、失败还原、图形界面上的兜底页与阶段页、配置
文件的自愈）。这条线把那些东西背后的前提拿掉：不自动升级，判定连同它制造的麻烦一起
消失。

## 内核只做三件事

|        | 是什么                         |
| ------ | --------------------------- |
| **载体** | 起一个 node 进程挂 cordis，开一扇窗    |
| **取址** | 挂官方 loader 读 home 的条目表，把件挂上 |
| **桥**  | 命令与事件双向，`gwb://` 交出件的浏览器那半  |

外加一份只命名不做事的词汇表。曾经有第四件事叫装机，2026-09-08 整口拿掉：**内核不碰
pnpm**，装包是进 home 手动 `pnpm add` 的手工活，界面那半归件。

准入判据两道关：**一、凡是「第一个件存在之前必须发生的事」，才进内核，其余一律皆件。
二、真遇到需求才加**——不是「将来可能要」，是某件事此刻就干不成，而且现场说得出来。
加功能的默认形态是加一个件。

## 跑起来

```powershell
pnpm install
pnpm start     # electron-vite build && electron .
pnpm check     # typecheck + oxlint + vitest,提交前跑
```

home 落在 `%APPDATA%/gwb-kernel/homes/<名>`（`GWB_HOME` 选格，不给是 `default`）。全新
home 起来窗口先摆一张已装清单（阶段页）——界面由件交出（provide `gwbShell` 服务的那个），
上来就顶掉清单。装件两步：进 home `pnpm add`，`cordis.yml` 手写一条条目，重启。

## 刻意不做的

不是还没做，是决定不做：装机口（内核不碰 pnpm）、自动升级、盘上对账与失败还原、图形
界面上的失败兜底页、件之间的准入核对、配置文件的模板与自愈。每一条的理由都在文档
站里写着；要做，得先推翻上面那句准入判据。

## 文档

文档站在 `docs-site/`，用 fumadocs 起：

```powershell
pnpm --filter gwb-kernel-docs-site dev     # http://localhost:4314
```

**代码注释只写现状**——为什么这么写、撞过什么、症状是什么，全在文档站的
[轨迹](/docs/trajectory)（定过的事与撞过的墙，一卡一文件），并且用 livedoc 钉在对应
代码上：代码一改文档就报黄，得有人复核。

`livedoc check` **不在 `pnpm check` 里**——它要起文档站的解析链，太慢，每次跑测试都带上
不值。单独两条 `pnpm doc` / `pnpm doc:confirm`，改了被钉住的代码就跑一次。

这份 README 是生成物，正本是 `docs-site/content/docs/readme.mdx`，改完在 `docs-site` 跑
`pnpm livedoc render --target ai` 重摆，一起提交。
