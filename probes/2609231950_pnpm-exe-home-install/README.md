# 只带一个 pnpm.exe，能不能在新 home 里装好命令插件与插件管理；装坏了怎么补；插件管理怎么依赖 pnpm

## 问什么

设计「命令插件与插件管理随安装包预装」（文档站 `/spec/platform-plugins`）要求：新 home 第一次启动时，内核用安装包自带的
pnpm 在 home 里运行 `pnpm install`；`package.json` 列的包在 `node_modules` 里有缺的就运行。插件管理自己依赖一份固定版本的
pnpm。落地前要确认四件事：

1. 安装包里只放一个 `pnpm.exe` 文件，够不够完成 `pnpm install`
2. 某个包的目录没了，再运行 `pnpm install` 能不能补回来
3. 装到一半被强杀，「列的包有缺」这个判据能不能发现，再运行一次能不能补齐
4. 插件管理在 home 里依赖 pnpm，依赖 `pnpm` 包还是本机平台的 `@pnpm/exe.win32-x64`；运行中的 `pnpm.exe` 把自己升级、降级时会不会因为文件被占用而失败

## 怎么跑

```powershell
npm ci
node run.mjs > runs/03-rerun.txt
```

依赖只有 `@pnpm/exe.win32-x64@12.4.2`（它的包里只有一个 `pnpm.exe`）。只能在 Windows x64 上跑。
直接用 `node` 运行，不要用 `npm run`：`npm run` 会往环境里塞 `npm_config_*`，pnpm 会读到。脚本启动 pnpm 时也照内核将来的做法，
去掉 `ELECTRON_RUN_AS_NODE` 与所有 `npm_*` 变量，其余环境原样传下去（所以会读到用户级 `.npmrc` 里的 `@godcreator` 包源与包龄豁免）。

`run.mjs` 把所有现场建在系统临时目录 `gwb-pnpm-probe-*` 下，不碰任何 gwb home，跑完不自动清理（路径打印在第一行和最后一行）。
模板用包源上已发布的 `@godcreator/gwb-commands@0.4.6` 与 `@godcreator/gwb-plugin-manager@0.7.1`。每个场景打印一行 JSON：

- `1a` / `1b`：把 `pnpm.exe` 单独拷到一个空目录，在只有 `package.json` 与 `cordis.yml` 的目录里 `pnpm install`；`1a` 用全新的存储目录（相当于新机器），`1b` 用本机默认存储
- `2a` / `2b` / `2c`：删掉 `node_modules/@godcreator/gwb-commands` 这条链接，分别用 `pnpm install`、`pnpm install --force`、删掉 `node_modules/.modules.yaml` 后 `pnpm install` 去补
- `3-kill-after-*`：全新存储、全新 home，`pnpm install` 启动若干毫秒后整棵进程树强杀，记下现场，再运行一次 `pnpm install`
- `4a`：home 依赖 `pnpm@12.4.1`；`4b`：home 依赖 `@pnpm/exe.win32-x64@12.4.1`。装好后用 home 里那份 12.4.1 的 `pnpm.exe` 运行 `add …@12.4.2`，再用 12.4.2 那份运行 `add …@12.4.1`

`runs/01-baseline.txt` 是第一次运行：强杀定在 1.5 / 4 / 8 秒，全新存储下整个安装只要 3 秒左右，强杀全部落在装完之后，第三项没有测到；
第二项也只试了普通 `pnpm install`。`runs/02-repair-and-early-kill.txt` 是改成现在这版脚本后的运行，下面的结论以它为准。

## 结论

1. **只带一个 `pnpm.exe` 就够**：全新存储装两个插件（连同依赖共 6 个包）2.7 秒，本机默认存储 0.3 秒，退出码 0，两个包都在。
   `pnpm install` 会在 home 里生成 `pnpm-lock.yaml`
2. **某个包的链接没了，普通 `pnpm install` 补不回来**：它只说 `Already up to date`，退出码 0，包仍然缺着；删掉 `.modules.yaml` 后再装也一样。
   只有 `pnpm install --force` 补回来了（存储里都有，67 毫秒）
3. **装到一半被强杀，判据能发现，普通 `pnpm install` 能补齐**：300 到 1200 毫秒强杀的四次，现场都是 `node_modules` 已经建了、
   `.modules.yaml` 与 `pnpm-lock.yaml` 都还没有、两个包都缺；再运行一次 `pnpm install` 都装齐了（1200 毫秒那次碰上网络重试，用了 1 分 25 秒）。
   1600 毫秒以后强杀时已经装完
4. **插件管理要直接依赖 `@pnpm/exe.win32-x64`，不能依赖 `pnpm` 包**：
   - `4a`：`pnpm` 包带 `preinstall` / `postinstall` 脚本，pnpm 默认不运行依赖的安装脚本，并以 `ERR_PNPM_IGNORED_BUILDS` 退出码 1 结束——
     包其实已经放好了，但每次改 home 都会报失败。第一次装它还用了 141 秒（`pnpm` 包要下载各平台的元数据）
   - `4b`：直接依赖 `@pnpm/exe.win32-x64` 没有安装脚本，装、升级、降级都是退出码 0，一次 70 到 150 毫秒
   - **运行中的 `pnpm.exe` 升级、降级自己都没有被占用卡住**：pnpm 把 `node_modules` 下的链接换到新版本目录，旧版本目录留在
     `node_modules/.pnpm` 里没有删，正在运行的那个文件一直在原处

对设计的影响：

- 判据「列的包有缺就 `pnpm install`」对新 home 与装到一半的 home 都成立；对「装完以后有人删了某个包」这种情况不成立，
  普通 `pnpm install` 修不好，每次启动会再运行一次（约 80 毫秒，只说已是最新）
- `--force` 虽然能修，但 pnpm 文档里它还会「装上不符合当前平台的可选依赖」，放进每次启动的路径代价不清楚，不采用
- 插件管理的依赖写 `"@pnpm/exe.win32-x64": "<精确版本>"`；将来要支持别的平台时，这个包名要按平台换
- 「升级 pnpm 时被占用」的担心不成立，不需要把 `pnpm.exe` 另外复制一份

## 跑那次的环境

- 日期：2026-09-23
- 平台：Windows 11 Pro 10.0.26200，pwsh 7.6.6
- node v24.14.1，npm 11.11.0
- 被测对象：`@pnpm/exe.win32-x64` 12.4.2（场景四另用 12.4.1、`pnpm` 12.4.1 / 12.4.2），包源上的 `@godcreator/gwb-commands@0.4.6`、`@godcreator/gwb-plugin-manager@0.7.1`
- 用户级 pnpm 配置：`@godcreator` 包源与 `minimumReleaseAgeExclude: @godcreator/*` 照 `INSTALL.md` 配好（输出里的 `Lockfile passes supply-chain policies` 来自这份配置）
- 内核仓 HEAD：`15ea216021852f098a7b4f1c631587eb115b737c`（2026-09-23）
- 本实验只借内核仓存放，不 import 仓里任何代码
