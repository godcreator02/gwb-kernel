---
name: gwb-test
description: 在你打算说「验过了 / 跑通了 / 改动生效了」之前用。实机验证——每次验开自己的隔离 home 与命名法、开之前怎么确认产物是新的、件进 home 只有哪一条路、哪几种「看着成了」其实什么都没验、怎么从页面里取证。
---

# 实机验证：先确认你验的是新代码

`pnpm typecheck` 全绿只说明源码站得住。装出来能不能跑是另一件事，这份 skill 管后者。
本仓是单进程内核（cordis 住 Electron 主进程），没有宿主子进程，也没有 `gwb://`：
件的浏览器半直接从 `file://` 取。

## 一、每次验开自己的 home

**一次验证一个新 home，不复用上一次留下的。**

```powershell
cd <内核仓>\apps\desktop
pnpm build                                    # 改了内核才需要；tsc 直出 dist/
$env:GWB_HOME = 'data-2609070700'              # <被测件短名>-<yyMMddHHmm>
.\run.cmd
```

`GWB_HOME` 给**名字**就落在 `%APPDATA%\gwb-kernel\homes\<名>\`（不用先创建）；给**路径**
（含 `\` 或 `/`）就用那个目录本身。不给就是 `default`，那是日常那份，**别拿它验东西**。

**命名 `<被测件短名>-<yyMMddHHmm>`**：`data-2609070700`、`shell-2609071130`。不冲着某个件的验证
前缀用一个说清这次验什么的短词：`boot-2609070700`、`reg-2609091200`。

**为什么不许复用**：一个 home 用上两天，里面就是十几个不同时刻装进去的版本快照，外加几个
仓里已经删掉、home 里还跑着的件。那时你不知道自己在验什么。

## 二、开之前：产物是不是新的

三条，漏一条就是在验旧代码，**而且界面看着一切正常**：

1. **改了内核** → `pnpm build`。不构建，起的是上一次的 `dist/`
2. **改了件** → 件仓里 `pnpm build` **再**发版。件如果没有 `prepublishOnly`，`pnpm publish`
   会把上一版的 `dist/` 原样发出去——这个坑真撞过
3. **改了共享包**（`gwb-tokens` / `gwb-shared-react`）→ 它们装在 home 里，得重发再装

## 三、件进 home 只有一条路

```powershell
# 1. 抬版本号 → 2. 发本机 registry → 3. 装进那个 home → 4. 改 cordis.yml
pnpm --filter <包名> publish --no-git-checks
cd <home 目录>
pnpm add <包名>@<版本>
```

**home 在仓里时 `pnpm add` 要带 `--ignore-workspace`**：pnpm 会顺着目录往上找到仓的
`pnpm-workspace.yaml`，把 home 误认成 workspace 成员。

**刚发的包为什么装得进去**：pnpm 11 起 `minimumReleaseAge` 默认 1440 分钟。这台机器上已经在
用户级配置里放行了整个 scope（`C:\Users\<你>\AppData\Local\pnpm\config\config.yaml` 的
`minimumReleaseAgeExclude: ['@godcreator02/*']`）。这个文件不在任何仓里，换机器会丢。

**坑：home 里的 `pnpm-workspace.yaml` 会整份盖掉全局，不合并。** 开新 home 时别建这个文件。

**不许走「直接读件仓源码」的近路。** 把件仓（`D:\unitfolders\26090709qzp\gwb-base-plugins`）
里的目录 `pnpm add` 成 link 只在契约实验期间允许，验发版的时候必须从 registry 装——`exports`
漏一个子路径、`files` 少带一个目录，在近路上都不显形，装出来才炸。

## 四、几种「看着成了」其实什么都没验

1. **拿日常 `default` 验**。验完那个 home 里就多了几个只为验证装的件、改过的 `cordis.yml`、
   落下的 `data/`——下次再验时它已经不干净了
2. **只看「挂上了」不看件真干了活**。`apply` 里的 async 一旦静默 reject，现象就是「挂上了但
   什么都没发生」——件里那条链必须自己 catch 并打出来
3. **量颜色靠「等过渡跑完」**。窗口最小化时 Chromium 节流后台动画。先注一条 `transition:none`
   再读；返回 `oklab(…)` 格式就是「还在过渡中」的指纹
4. **改了内核没重新 build**。第二节第 1 条，最隐蔽的一种：界面全对，验的是上一版
5. **窗格不在 DOM 里就判它没挂上**。dockview 只渲染激活的那格，几格同组时只有最后开的那格
   在 DOM 里。取证前先点它的标签：`.dv-tab` 上
   `dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`

## 五、清理放在开新的那一刻

验完的 home 留着——人要亲自看一眼。清理动作**放在开新的那一刻**，不是验完就清：

```powershell
Get-ChildItem $env:APPDATA\gwb-kernel\homes -Directory   # 先看积了多少
Remove-Item $env:APPDATA\gwb-kernel\homes\<旧的> -Recurse -Force
```

仓里不放验场，也不入库任何临时 home。

## 六、拿证据

起的时候带 `--remote-debugging-port=<端口>`（Chromium 开关在命令行上就生效，内核不管它；
9222 是别的实例常用的，换一个），再用本 skill 目录里的小工具连 CDP 求值：

```powershell
cd <内核仓>\apps\desktop
.\run.cmd --remote-debugging-port=9334
node <内核仓>\.claude\skills\gwb-test\cdp-eval.mjs 9334 <表达式文件>
```

**表达式放文件不放命令行**，PowerShell 的引号会截断它。文件里就是一个 async IIFE，返回值
即读数，放在临时目录（scratchpad）里，用完不入库。一个够用的样子：

```js
(async () => {
  const panes = await window.gwb.command('shell.panes')
  const node = await window.gwb.command('hello.node')
  // dockview 只渲染激活的格，先点标签再查 DOM
  const tab = [...document.querySelectorAll('.dv-tab')].find((t) => t.textContent.trim() === '日志')
  tab?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 600))
  console.log('probe-live-line')
  await new Promise((r) => setTimeout(r, 800))
  const pane = document.querySelector('[data-gwb-plugin="@godcreator02/gwb-logger"]')
  return {
    hasDockview: !!document.querySelector('.dv-groupview'),
    panes: (panes.data ?? []).map((p) => `${p.pkg}#${p.id} client=${p.client ? 'yes' : 'no'}`),
    nodeExit: node.exitCode,
    liveHit: pane ? [...pane.querySelectorAll('.font-mono')].some((el) => el.textContent.includes('probe-live-line')) : null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }
})()
```

**日志在 `<home>\gwb.log`**——内核自己的话、件的、渲染层 console 转来的，全在这一份里，
一行一条 `时间 级别 名字 正文`。窗格那半归日志件，内核不管。
