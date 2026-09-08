---
name: gwb-test
description: 在你打算说「验过了 / 跑通了 / 改动生效了」之前用。实机验证——每次验开自己的隔离 home 与命名法、开之前怎么确认产物是新的、件进 home 只有哪一条路、哪几种「看着成了」其实什么都没验。
---

# 实机验证：先确认你验的是新代码

`pnpm check` 全绿只说明源码站得住——它**不依赖 build 产物**（typecheck / lint / vitest 吃的
都是源码）。装出来能不能跑是另一件事，这份 skill 管后者。

## 一、每次验开自己的 home

**一次验证一个新 home，不复用上一次留下的。**

```powershell
$env:GWB_HOME = 'data-2609070700'          # <被测件短名>-<yyMMddHHmm>
cd <内核仓>\apps\desktop
pnpm exec electron-vite build
.\node_modules\electron\dist\electron.exe .
```

home 自动建在 `%APPDATA%\gwb-kernel\homes\<名>\`，**不用先创建**。不给 `GWB_HOME` 就是
`default`——那是日常那份，**别拿它验东西**。

日常 home 活着且装了 devkit 的话，这四步可以命令化：`devkit.home.new`（开新＋默认
build）、`home.list` / `home.open` / `home.stop` / `home.rm`。**手工这四步仍是正典**——
还没有任何 home 活着时，命令化那半也起不来。

**命名 `<被测件短名>-<yyMMddHHmm>`**：`data-2609070700`、`shell-2609071130`。这样列目录时
同一个件的挨在一起、各自按时间排，正好是第五节清理时要的顺序。

**不冲着某个件的验证**（验从零装机、验主进程改动、验没有外壳时的留白）前缀用一个说清这次
验什么的短词：`boot-2609070700`、`empty-2609070700`。

名字得是 kebab-case——内核会当场拒掉不合规的（`GWB_HOME=../../x` 那种能跳出 `homes/`）。

**为什么不许复用**：一个 home 用上两天，里面就是十几个不同时刻装进去的版本快照，外加几个
仓里已经删掉、home 里还跑着的件。那时你不知道自己在验什么。

## 二、开之前：产物是不是新的

三条，漏一条就是在验旧代码，**而且界面看着一切正常**：

1. **改了内核** → 必须 `pnpm exec electron-vite build`。不构建，起的是上一次的 `out/`
2. **改了件** → 必须 `pnpm build` **再**发版。**`pnpm check` 不构建**，而件如果没有
   `prepublishOnly`，`pnpm publish` 会把上一版的 `dist/` 原样发出去——**这个坑真撞过**：
   件挂上了、不报错、新写的东西全没生效，查了一圈才想起产物是旧的
3. **改了共享包**（`gwb-tokens` / `gwb-shared-react`）→ 它们装在 home 里，得重发再装

## 三、件进 home 只有一条路

```powershell
# 1. 抬版本号 → 2. 发本机 registry → 3. 装进那个 home → 4. 改 cordis.yml
pnpm --filter <包名> publish --no-git-checks
cd $env:APPDATA\gwb-kernel\homes\<名>
pnpm add <包名>@<版本>
```

**刚发的包为什么装得进去**：pnpm 11 起 `minimumReleaseAge` 默认 1440 分钟——包发布后
要放够一天才准装。刚 publish 的包年龄是 0 分钟，本该每次都被拦。这台机器上已经在
**用户级配置**里放行了整个 scope，所以不用管：

```yaml
# C:\Users\<你>\AppData\Local\pnpm\config\config.yaml
minimumReleaseAgeExclude:
  - '@godcreator02/*'
```

这个文件**不在任何仓里**，换机器或重装会丢。症状是「在新机器上突然装不上刚发的包」，
报错只说版本太新，不会提醒你少了这份配置。`pnpm config get globalconfig` 报的就是它的位置。

**坑：home 里的 `pnpm-workspace.yaml` 会整份盖掉全局，不合并。** 那批老 home 里留着的
逐版本 `minimumReleaseAgeExclude` 清单，正好把全局那条通配挡在门外——在那种 home 里
装新版本仍会被拦，还得手动补一条。开新 home 时**别建这个文件**，让它吃全局的。

**不许走「直接读仓内源码」的近路。** 近路绕开了安装这个动作，于是开发时跑通的和装出来的
不是同一条路：`exports` 漏一个子路径、`files` 少带一个目录，在近路上都不显形，装出来才炸。

## 四、几种「看着成了」其实什么都没验

1. **拿日常 `default` 验**。验完那个 home 里就多了几个只为验证装的件、改过的 `cordis.yml`、
   落下的 `data/`——下次再验时它已经不干净了
2. **只看「挂上了」不看件真干了活**。日志里 `[host] 挂上 xxx` 只说明模块 import 成功、
   `apply` 被调用了。`apply` 里的 async 一旦静默 reject，现象就是「挂上了但什么都没发生」——
   **件里那条链必须自己 catch 并打出来**
3. **量颜色靠「等过渡跑完」**。窗口最小化时 Chromium 节流后台动画，等多久都可能读到起点值。
   先注一条 `transition:none` 再读；返回 `oklab(…)` 格式就是「还在过渡中」的指纹
4. **改了内核没重新 build**。第二节第 1 条，最隐蔽的一种：界面全对，验的是上一版

## 五、清理放在开新的那一刻

验完的 home 留着——人要亲自看一眼。但每次一个，一周就是二十个。所以清理动作**放在开新的
那一刻**，不是验完就清：

```powershell
Get-ChildItem $env:APPDATA\gwb-kernel\homes -Directory   # 先看积了多少
Remove-Item $env:APPDATA\gwb-kernel\homes\<旧的> -Recurse -Force
```

这样人永远有机会看，也永远不会积压超过一轮。成本不在盘上（`.pnpm` 是硬链接到全局 store，
实际增量很小），在你自己看不过来。

## 六、拿证据

没有专门的探针命令行。要读页面里的东西，起 electron 时带 `--remote-debugging-port=9222`，
再用一段 node 脚本连 CDP 求值（`Runtime.evaluate`）。这条路子这条线上跑通过：注 importmap、
量计算样式、切亮暗都验过。

**日志在 `homes/<名>/logs/gwb.log`**——跟着 home 走，所以测试 home 的日志天然是分开的。
主进程自己的、宿主 pipe 过来的、渲染层 `console-message` 转来的，三处都汇在这一份里。
