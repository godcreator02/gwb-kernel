# 装机形态（C）正本

2026-09-15 三轮拍板的最终形态。前身是装机单元 26091511ins（B 雏形：吃 registry 钉版），
同日迁入本仓并改口吃本仓构建——发版动作的产物是 exe，不是 npm 包。2026-09-18 拿掉种子：
安装包只带内核，装机交给 agent 照仓根 `INSTALL.md` 做。

## 拍板

| 口子 | 定稿 |
| --- | --- |
| 发版形态 | **发版 = 发 exe**：NSIS 安装器（per-user 免管理员）+ 便携 zip 双目标，传 gitea releases |
| 落地 | 装配线住内核仓 `installer/`（装机单元退役）；**内核运行时零改动**，壳是包外引导层 |
| 输入源 | 本仓 `apps/desktop` 的构建：build → `pnpm pack` tarball（同源同 files 过滤；workspace 协议替换与发 registry 同规则） |
| electron 版本 | **单一真源** `apps/desktop` 的 `devDependencies.electron`，build.ps1 现读现传 |
| 插件 | **安装包不带任何插件**（2026-09-18 起，此前带一份种子）。装机由 agent 照仓根 `INSTALL.md` 做：机器上三样配置 → 装 exe → 往 default home 写 `package.json` 与 `cordis.yml`、`pnpm add` 基础件 → 启动 → 连 MCP 门。同一个版本号的安装包内容唯一；home 从第一秒归 pnpm 管 |
| 壳版本 | app 模板的 version 渲染成内核版：产物名报内核版（内核自己的版本读内核包清单，不经壳） |
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
- 装机交给 agent：首次装件会撞上的网络、镜像、pnpm 版本、新包放行、装到一半失败，写成代码
  就是这条线当初砍掉的那套「让失败体面」的机器；agent 当场判断处理，说明书一份就够

## 几堵墙（别「简化」回去）

1. electron-builder 的版本探测只看项目根、不看 `directories.app`——所以版本经
   `--config.electronVersion` 从 CLI 传，yml 里不钉
2. 内核清单的 `workspace:*` 协议只有 **pnpm pack** 会替换成实际版本；`npm pack` 原样打进
   tarball，消费端当场 `EUNSUPPORTEDPROTOCOL`——pack 一律走 pnpm
3. pwsh 对原生命令的非零退出码默认不炸：装配步骤每个 npm/pnpm 后都有退出码断言＋
   产物存在断言（空目录一路出包的事故发生过一次，别拆）
4. **推 tag 会把同名 draft release 自动转发布**（v0.2.2 实弹：tag 一到、draft 即公开）。
   要走「draft＋人工确认」就把 tag 留到最后推；不介意直接公开就随手推

（种子那两堵——extraResources 硬排 node_modules 要垫高一层、种子旧锁钉死解析——随种子退役，
经过留在文档站轨迹卡。）

## 发行（2026-09-15 实测定稿）

- 发行仓 `godcreator/gwb-kernel`：**公开、源码同仓**（单分支 main）、release 挂 Windows 包；
  push 走 GCM 凭据，API 走 gwb-gitea 插件的 `gitea.http`（配方在其说明书）
- **release 只传 exe**：`gwb-setup-<版>.exe`。便携 zip 只在本地构建、不上 release
- tag 随内核版本打（`v<版>`），与 release 一一对应；release 说明指向仓根 `INSTALL.md`

## 验机

- 打包形态的壳→内核链通：bootstrap 从 asar 里 import 内核正常
- 门的好品性：2870 被占时 default 不换口；别的 home 自动挑口
- 单开锁拒第二实例（退出码 1、不动 runtime.json）
- **装机说明的验法**：派一个不带上下文的子代理，只给它 `INSTALL.md`，让它往一个临时 home
  （`GWB_HOME` 给路径）里照做一遍、起 `build\dist\win-unpacked\` 的内核，门调得通、条目全
  ACTIVE 才算过；它不得不问的每个问题都是说明书的洞。**别裸跑 win-unpacked 不带 GWB_HOME**
  ——那会去开真 default home（锁与 runtime.json 是它的）

## 待办

- [x] 发版实测（2026-09-15）：建仓（公开＋源码）、tag v0.2.2、release 传 exe，全程 gitea.http
      完成；publish-gitea.ps1 同日删（被插件取代）
- [ ] kernel 仓记轨迹卡（A/B → B 雏形 → C 的发行形态了断）
- [ ] 文档收尾：AGENTS（生成物，走 mdx 正本＋render）补「怎么发 exe」、devkit 外循环改口、
      总控台仓表加行
- [x] gwb-app 安装位单元（26091201qzv）退役（2026-09-15：日常台切安装版、381 MB 单元与两处
      run.cmd 同日删；门回 2870 标准口，agent 侧 MCP 配置不动）
- [x] 真机首启验证随种子退役作废（2026-09-18）：首启不再铺任何东西，装机按 `INSTALL.md` 验
