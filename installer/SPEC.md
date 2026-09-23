# 安装包方案（形态 C）

2026-09-15 定下的形态。前身是单独的安装单元 26091511ins（从包源装固定版本的内核），同日迁入本仓，
改为用本仓的构建产物——发版的产物是 exe，不是 npm 包。2026-09-18 起安装包不带插件种子，安装由 agent
照仓根 `INSTALL.md` 做；2026-09-23 起命令插件与插件管理内置进内核，安装包另带一份 pnpm。

## 定下的做法

| 方面 | 做法 |
| --- | --- |
| 发版形态 | **发版 = 发 exe**：NSIS 安装包（按当前用户安装、不需要管理员）+ 便携 zip 两种产物，传到 gitea releases |
| 位置 | 打包脚本在内核仓 `installer/`；**不改内核运行时**，外层只是一个启动内核的引导脚本（`app-template/bootstrap.mjs`） |
| 输入 | 本仓 `apps/desktop` 的构建：build → `pnpm pack` 出 tarball（`files` 过滤与发 npm 包时相同，`workspace:` 依赖由 pnpm 替换成版本号） |
| electron 版本 | **只写在一处**：`apps/desktop` 的 `devDependencies.electron`，build.ps1 读出来传给 electron-builder |
| 插件 | 内核包里带两个内置插件（命令插件与插件管理，构建时复制进 `dist/builtin/`，随内核版本发布）。其余插件**不随安装包**：由 agent 照仓根 `INSTALL.md` 做——配用户级 pnpm 配置 → 装 exe → 往 default home 写 `package.json` 与 `cordis.yml`、用安装包里的 pnpm `pnpm add` 基础插件 → 启动 → 连 MCP 入口。同一个版本号的安装包内容唯一；home 从一开始就由 pnpm 管理 |
| 外层版本 | app 模板的 version 替换成内核版本：产物文件名带内核版本（内核自己的版本读内核包的清单，不读外层） |
| pnpm 来路 | **安装包自带固定版本的 pnpm**：build.ps1 从 `apps/desktop` 的开发依赖 `@pnpm/exe.win32-x64` 复制 `pnpm.exe` 与它的清单到 `build\pnpm\`，electron-builder 放进 `resources\pnpm\`。内核打包运行时把这个路径交给内置的插件管理；用户不需要自己装 pnpm |
| 升级 | 重新运行安装包。home 数据（`%APPDATA%\gwb-kernel\homes`）不动；内置的两个插件随内核一起升级 |
| npm 发布 | **2026-09-18 已停止**：发版只有 exe 一条路。包源上那三个版本（0.2.0–0.2.2）已删；要恢复就从仓里重新发一版（理由见轨迹卡 2026-09-18「撤 npm 管道」） |

**`cordis.yml` 里的插件不走安装包**：它们一律走包源 + 一键热升级。每发一个插件版本就重打 exe，等于废掉热升级，不这样做。
内置的两个插件是例外：它们没有替换的必要，随内核发版（轨迹卡 2026-09-23「核心插件内置」）。

## 为什么这样做

- 运行时不依赖系统 node：插件由内置的插件管理直接启动安装包里的 pnpm 原生可执行文件安装
- home 与安装形态分开：内核自己补 home 缺的文件、不覆盖；home 的根在 main.ts 里固定
  （`appData/gwb-kernel/homes`），不从包名推算
- 包源不带 token 也能读（2026-09-15 实测无 token `npm view` 成功）——安装插件没有门槛
- 用本仓的 tarball 而不是从包源装固定版本：避免「发完版还要到另一个仓改固定版本」的延迟和两处版本对不上
- 插件由 agent 安装：第一次安装插件会遇到的网络、镜像、新包放行、装到一半失败，写成代码就是一整套处理失败的逻辑；
  agent 当场判断处理，一份说明就够

## 遇到过的问题（别「简化」回去）

1. electron-builder 只在项目根找 electron 版本、不看 `directories.app`——所以版本经
   `--config.electronVersion` 从命令行传，yml 里不写
2. 内核清单里的 `workspace:*` 只有 **pnpm pack** 会替换成实际版本；`npm pack` 原样打进 tarball，安装时报
   `EUNSUPPORTEDPROTOCOL`——打包一律用 pnpm
3. pwsh 对原生命令的非零退出码默认不停：打包脚本的每个 npm / pnpm 之后都检查退出码，并检查产物存在
   （出过一次组装目录是空的却一路打出安装包的事故，这两道检查别删）
4. **推 tag 会让同名的 draft release 自动发布**（v0.2.2 实际发生过：tag 一推、draft 就公开了）。
   要「先 draft、人工确认后发布」就最后再推 tag；不介意直接公开就随时推
5. 内置插件不能写成内核包的依赖：安装包组装时从包源装内核 tarball 的依赖，写成依赖就得单独发布它们。
   所以构建时把它们的构建产物复制进内核的 `dist/builtin/`，build.ps1 检查组装目录里有这些文件

（插件种子相关的两个问题——extraResources 要多套一层目录、种子的旧锁文件固定了解析结果——随种子一起取消，
记录在文档站的轨迹卡。）

## 发布

- 发布仓 `godcreator/gwb-kernel`：**公开、源码在同一个仓**（单分支 main）、release 挂 Windows 安装包；
  push 走 GCM 凭据，API 走 gwb-gitea 插件的 `gitea.http`（用法在它的说明书）
- **release 只传 exe**：`gwb-setup-<版>.exe`。便携 zip 只在本地构建、不上传
- tag 跟内核版本走（`v<版>`），与 release 一一对应；release 说明指向仓根 `INSTALL.md`

## 验证

- 打包形态下引导脚本能从 asar 里 import 内核，内核能从 `dist/builtin/` 加载两个内置插件
- MCP 入口：2870 被占用时 default 不换端口；别的 home 自动选端口
- 单实例锁拒绝第二个实例（退出码 1、不动 runtime.json）
- **安装说明的验证方法**：派一个没有上下文的子代理，只给它 `INSTALL.md`，让它往一个临时 home
  （`GWB_HOME` 给路径）里照做一遍、启动 `build\dist\win-unpacked\` 的内核，MCP 入口能调通、条目全部
  ACTIVE 才算通过；它不得不问的每个问题都是说明的漏洞。**别不带 GWB_HOME 直接运行 win-unpacked**
  ——那会打开真正的 default home（锁与 runtime.json 都是它的）

## 待办

- [x] 发版实测（2026-09-15）：建仓（公开＋源码）、tag v0.2.2、release 上传 exe，全程用 gitea.http
      完成；publish-gitea.ps1 同日删除（被插件取代）
- [ ] 内核仓写轨迹卡（A/B → B 雏形 → C 的发行形态）
- [ ] 文档收尾：AGENTS（生成物，改 mdx 正本再 render）补「怎么发 exe」、devkit 外循环的说明改掉、
      总控台仓表加一行
- [x] gwb-app 安装单元（26091201qzv）退役（2026-09-15：日常改用安装版、381 MB 单元与两处
      run.cmd 同日删除；MCP 入口回到 2870 标准端口，agent 侧 MCP 配置不动）
- [x] 真机首次启动验证随种子取消而作废（2026-09-18）：首次启动不再复制任何东西，安装按 `INSTALL.md` 验证
