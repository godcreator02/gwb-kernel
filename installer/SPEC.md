# 装机形态（C）正本

2026-09-15 三轮拍板的最终形态。前身是装机单元 26091511ins（B 雏形：吃 registry 钉版），
同日迁入本仓并改口吃本仓构建——发版动作的产物是 exe，不是 npm 包。

## 拍板

| 口子 | 定稿 |
| --- | --- |
| 发版形态 | **发版 = 发 exe**：NSIS 安装器（per-user 免管理员）+ 便携 zip 双目标，传 gitea releases |
| 落地 | 装配线住内核仓 `installer/`（装机单元退役）；**内核运行时零改动**，壳是包外引导层 |
| 输入源 | 本仓 `apps/desktop` 的构建：build → `pnpm pack` tarball（同源同 files 过滤；workspace 协议替换与发 registry 同规则） |
| electron 版本 | **单一真源** `apps/desktop` 的 `devDependencies.electron`，build.ps1 现读现传 |
| 种子 | 十一件挂条目（commands、data、settings、skills、logger、plugin-manager、shell、baseui、node-cli、devkit、mcp）＋两共享库；`>=` 下限**浮动解析、不提交 lockfile**——打包时各件取 registry 上的 latest，件集常规升版（含 0.x 的次版本跳变）零提交，换血（加减件/抬下限）才动本仓。不写 `^`：0.x 上 `^0.7.1` 只认 0.7.x，每次次版本跳变都得回本仓改一笔（2026-09-18 改）。2026-09-17 从六件扩到十一件：门的 instructions 教 `run skill.read` 而种子没有 skills、外壳里没有插件管理格，判据见文档站轨迹卡 |
| 壳版本 | app 模板的 version 渲染成内核版：`runtime.json` 与产物名都报内核版 |
| pnpm 来路 | **用户自装 pnpm 12+**（原生可执行）。不随包带、不代装；plugin-manager 查找链 setting → PATH → 明确报错，版本低于 12 同样明确报错 |
| 升级 v1 | 重跑安装器。home 数据（`%APPDATA%\gwb-kernel\homes`）不动 |
| npm publish | 降为内部管道：发版不再以它为终点，但先留着（零成本、退路）；安装位退役后若无消费者再决定停 |

**插件线不受本形态影响**：插件永远走 registry + update-all 热升，不走安装器——每发一个
插件版就重打 exe 等于废掉热升架构，禁止。

## 判据（为什么成立）

- 运行时不依赖系统 node：插件装机是 plugin-manager 直接起 pnpm 12 的原生可执行
- home 与安装形态解耦：内核自铺 home、不覆盖；home 根在 main.ts 写死
  （`appData/gwb-kernel/homes`），不从包名推
- registry 匿名读已验（2026-09-15 实测无 token `npm view` 通）——收件人拉件无门槛
- 吃 tarball 而非 registry 钉版：消掉「发完版要另仓 bump pin」的滞后与两处 pin 的错配
  （装机位挂死反馈的嫌疑正是错配类）

## 几堵墙（别「简化」回去）

1. electron-builder 的版本探测只看项目根、不看 `directories.app`——所以版本经
   `--config.electronVersion` 从 CLI 传，yml 里不钉
2. extraResources 的复制过滤**硬排 from 根下的 node_modules**（filter.js 写死，pattern
   盖不过）——构建时把种子垫高一层（`build/stage/payload`），from 指垫高后的目录
3. 内核清单的 `workspace:*` 协议只有 **pnpm pack** 会替换成实际版本；`npm pack` 原样打进
   tarball，消费端当场 `EUNSUPPORTEDPROTOCOL`——pack 一律走 pnpm
4. pwsh 对原生命令的非零退出码默认不炸：装配步骤每个 npm/pnpm 后都有退出码断言＋
   产物存在断言（空目录一路出包的事故发生过一次，别拆）
5. **推 tag 会把同名 draft release 自动转发布**（v0.2.2 实弹：tag 一到、draft 即公开）。
   要走「draft＋人工确认」就把 tag 留到最后推；不介意直接公开就随手推
6. **种子的 `package-lock.json` 每次打包前删**：它不进 git，但留在盘上时 npm 照它装，
   `>=` 下限被旧解析满足就不去拿新版（2026-09-18 实弹：shell 已发 0.9.0，重打的包里仍是 0.8.0）。
   只删 node_modules 不够

## 发行（2026-09-15 实测定稿）

- 发行仓 `godcreator/gwb-kernel`：**公开、源码同仓**（单分支 main）、release 挂 Windows 包；
  push 走 GCM 凭据，API 走 gwb-gitea 插件的 `gitea.http`（配方在其说明书）
- **release 只传 exe**：`gwb-setup-<版>.exe`。便携 zip 只在本地构建、不上 release
- tag 随内核版本打（`v<版>`），与 release 一一对应

## 验机读数（2026-09-15，B 雏形期 + 迁移后复核）

- 打包形态的壳→内核链通：bootstrap 从 asar 里 import 内核正常
- 预铺种子的临时 home（`GWB_HOME` 指过去）全件挂起：六件注册齐、外壳上线、`kernel up`
  落款；theme 不在种子里那条 warn 是预期的
- 门的好品性：2870 被占时自动挑口（实测挑了 61930）
- 保护路径实弹验过：真 default 存在 → 种子跳过；单开锁拒第二实例（退出码 1、不动 runtime.json）
- **没验到的**：收件人真首启那条（default 缺失 → cpSync 铺种子）本机验不了——Windows 上
  Electron 的 appData 走 shell API、不认 `APPDATA` 环境变量重定向。决策逻辑有单测、
  模板在产物里核过；留到第一台真装机（或 VM）确认
- 本机验机法：`GWB_HOME` 指一个预铺了 `build\dist\win-unpacked\resources\seed-home\payload`
  内容的临时目录再起 win-unpacked。**别裸跑 win-unpacked 不带 GWB_HOME**——那会去开真
  default home（种子会跳过，但锁与 runtime.json 是它的）

## 待办

- [ ] 真机首启验证（default 缺失 → 铺种子；本机验不了，见上）
- [x] 发版实测（2026-09-15）：建仓（公开＋源码）、tag v0.2.2、release 传 exe，全程 gitea.http
      完成；publish-gitea.ps1 同日删（被插件取代）
- [ ] kernel 仓记轨迹卡（A/B → B 雏形 → C 的发行形态了断）
- [ ] 文档收尾：AGENTS（生成物，走 mdx 正本＋render）补「怎么发 exe」、devkit 外循环改口、
      总控台仓表加行
- [x] gwb-app 安装位单元（26091201qzv）退役（2026-09-15：日常台切安装版、381 MB 单元与两处
      run.cmd 同日删；门回 2870 标准口，agent 侧 MCP 配置不动）
