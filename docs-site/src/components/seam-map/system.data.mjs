/**
 * 全局接缝图的内容：首页的 <SeamMap /> 画的就是它。
 * 虚线框是本仓的两个包（内核应用、安装包），框里的方块是包对外的能力；cordis 与 loader、cordis.yml 里的插件、
 * 页面上运行的代码、home 里的文件、进程外的工具画在框外。
 * 接缝编号按依赖方向排：先是启动器接内核、内核接 cordis 与 home（1–3），再是插件接 loader 与内核（4–8），
 * 页面接内核（9），日志与 runtime.json 两份文件（10–12），最后是插件管理改条目与包（13）。
 * 每条接缝在首页有同名的一节，这里的 text 是那一节的概括。坐标不在这里，在 system.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docfirst-explainer/seam-graph';

/** @type {import('@godcreator/docfirst-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'page',
    name: '页面上的代码',
    pkg: '外壳与窗格的浏览器侧',
    role: null,
    outside: true,
    blurb: '在内核窗口里运行、由插件提供的模块：外壳的页面模块接管 #root，窗格等页面代码经 window.gwb 发请求、收事件。它们不在本仓。',
    caps: [
      { id: 'pg-shell', name: '外壳模块', ident: 'ShellBoot' },
      { id: 'pg-code', name: '页面代码', ident: 'window.gwb.*' },
    ],
  },
  {
    id: 'plugins',
    name: 'cordis.yml 里的插件',
    pkg: '装在 home 里',
    role: null,
    outside: true,
    blurb: '每个插件是 home 里的一个 npm 包、cordis.yml 里的一条条目，由 loader 加载进主进程。外壳、基础界面、命令插件、插件管理、MCP 入口都在这里，都不在本仓。',
    caps: [
      { id: 'p-shell', name: '外壳插件', ident: 'gwb-shell' },
      { id: 'p-provider', name: '请求提供方', ident: 'gwb-commands' },
      { id: 'p-any', name: '任何插件', ident: 'apply(ctx)' },
      { id: 'p-files', name: '日志与 MCP 入口', ident: 'logger · mcp' },
      { id: 'p-pm', name: '插件管理', ident: 'plugin-manager.*' },
    ],
  },
  {
    id: 'kernel',
    name: '内核应用',
    pkg: '@godcreator/gwb-kernel-desktop',
    role: 'blue',
    outside: false,
    blurb: 'apps/desktop，一个 npm 包，和插件一起装在每个 home 里。主进程里建 cordis 实例、加载插件、提供 gwbKernel、写日志与 runtime.json；页面这边提供 window.gwb 与页面入口；包根只导出接口类型。',
    caps: [
      { id: 'k-page', name: '页面入口', ident: 'index.html' },
      { id: 'k-preload', name: '页面接口', ident: 'window.gwb' },
      { id: 'k-log', name: '日志', ident: 'logger.exporter' },
      { id: 'k-types', name: '接口类型', ident: 'api.ts' },
      { id: 'k-boot', name: '启动与退出', ident: 'main.ts' },
      { id: 'k-imports', name: '浏览器模块登记', ident: 'registerImports' },
      { id: 'k-requests', name: '请求分发', ident: 'handleRequest' },
      { id: 'k-service', name: '内核服务', ident: 'ctx.gwbKernel' },
      { id: 'k-load', name: '插件加载', ident: 'bare-import.ts' },
    ],
  },
  {
    id: 'cordis',
    name: 'cordis',
    pkg: '',
    role: null,
    outside: true,
    blurb: 'cordis 是内核包的 peer（home 根上只有一份，内核与插件共用）；loader 与 include 是内核包自己的依赖，版本写死。插件的上下文、服务、日志流、条目树都来自它们。',
    caps: [
      { id: 'c-loader', name: 'loader 与 include', ident: 'ctx.loader' },
      { id: 'c-context', name: '上下文与日志流', ident: 'Context · ctx.logger' },
    ],
  },
  {
    id: 'installer',
    name: '安装包',
    pkg: 'NSIS',
    role: 'amber',
    outside: false,
    blurb: '启动器 apps/launcher 加 Electron，由 installer/ 的脚本打成安装程序。不带内核包、插件与 pnpm：它们装在 home 里。',
    caps: [
      { id: 'launcher', name: '启动器', ident: 'apps/launcher' },
      { id: 'installer-build', name: '打包脚本', ident: 'installer/' },
    ],
  },
  {
    id: 'tools',
    name: 'devkit 与装机 agent',
    pkg: '',
    role: null,
    outside: true,
    blurb: '工作台进程之外的程序：devkit 的命令与照 INSTALL.md 安装工作台的 agent。它们读 home 里的 runtime.json 找运行中的工作台，读 gwb.log 看日志。',
    caps: [{ id: 'x-tools', name: 'devkit 与装机 agent', ident: 'devkit.* · INSTALL.md' }],
  },
  {
    id: 'home',
    name: 'home 里的文件',
    pkg: 'GWB_HOME',
    role: null,
    outside: true,
    blurb: '磁盘上的一个目录，也是一个普通的 npm 项目根。package.json 与 cordis.yml 由创建 home 的一方写好；gwb.log 与 runtime.json 由内核写。',
    caps: [
      { id: 'h-runtime', name: '运行记录', ident: 'runtime.json' },
      { id: 'h-log', name: '日志文件', ident: 'gwb.log' },
      { id: 'h-pkgs', name: '包清单与包', ident: 'package.json · node_modules' },
      { id: 'h-yml', name: '条目清单', ident: 'cordis.yml' },
    ],
  },
];

/** @type {import('@godcreator/docfirst-explainer/seam-graph').SeamEntry[]} */
const entries = [
  { id: 'human-ui', name: '人（界面）', to: 'pg-shell' },
  { id: 'human-start', name: '人（开始菜单）', to: 'launcher' },
];

/** @type {import('@godcreator/docfirst-explainer/seam-graph').SeamInput[]} */
const seams = [
  /* ref file="../apps/launcher/src/main.ts" lines="17-19" hash="475fe289ea98" blob="f6547781d717" */
  /* ref file="../apps/desktop/package.json" lines="8-8" hash="3f8ef1581707" blob="df73ceac0ed7" */
  /* ref file="../apps/desktop/package.json" lines="34-36" hash="d14faf1367c1" blob="df73ceac0ed7" */
  {
    n: 1,
    name: '启动器加载内核',
    a: ['launcher'],
    b: ['k-boot'],
    iface: 'GWB_HOME（启动器写回绝对路径）；home 里内核包清单的 engines.electron 与 main',
    convention: true,
    via: 'disk',
    text: '启动器按和内核同一条规则选定 home、把绝对路径写回 GWB_HOME，读 home 里内核包的清单：当前 Electron 在 engines.electron 的范围里、有 main，才 import 入口；否则弹框退出。两边之间没有代码接口，只靠这份约定。',
  },
  /* ref file="../apps/desktop/src/main.ts" lines="361-368" hash="e5fc330ba54d" blob="db3e92ccd653" */
  /* ref file="../apps/desktop/package.json" lines="37-43" hash="9afff01b3cb1" blob="df73ceac0ed7" */
  {
    n: 2,
    name: 'cordis 与 loader',
    a: ['k-load'],
    b: ['c-loader', 'c-context'],
    iface: "new Context()；ctx.plugin(Loader)；loader.internal = { import: bareImportFromHome(dataDir) }；loader.builtins.include = Include",
    convention: false,
    via: 'code',
    text: '内核建 cordis 实例、把 home 设成模块解析起点、注册 loader，把 loader 的包名 import 换成按 home 解析，再把 include 交给 loader。cordis 写在内核包的 peer 里，loader 与 include 写在依赖里，版本都写死。',
  },
  /* ref file="../apps/desktop/src/main.ts" lines="46-47" hash="a753fc87f52c" blob="db3e92ccd653" */
  /* ref file="../apps/desktop/src/bare-import.ts" lines="10-13" hash="84fcae22dd01" blob="a03471e3e333" */
  {
    n: 3,
    name: 'home 里的条目与包',
    a: ['k-load', 'c-loader', 'k-boot'],
    b: ['h-pkgs', 'h-yml'],
    iface: "根条目 { id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }；<home>/node_modules/<包名> 先取真实路径再解析入口",
    convention: false,
    via: 'disk',
    text: '启动时 package.json 与 cordis.yml 缺一个就启动失败，内核不补。loader 根层只有一条 id 为 home 的 include 条目，由它读 cordis.yml；包名一律从 home 的 node_modules 按真实路径解析，运行中换了版本能拿到新的。',
  },
  /* ref file="../apps/desktop/src/api.ts" lines="28-31" hash="b43abfb17548" blob="b2cf0ae6f72c" */
  {
    n: 4,
    name: '插件加载',
    a: ['p-any'],
    b: ['c-loader', 'k-boot'],
    iface: 'export const name / inject；export function apply(ctx: GwbContext)，或默认导出 cordis 的 Service 类',
    convention: false,
    via: 'code',
    text: 'loader 按条目 import 插件包，入口导出 cordis 认识的形状，inject 里的服务都在了才调用 apply。内核保证插件出错只记日志、不退出，退出时卸载整棵插件树、最多等 5 秒。',
  },
  /* ref file="../apps/desktop/src/api.ts" lines="9-26" hash="05785cacfe68" blob="b2cf0ae6f72c" */
  {
    n: 5,
    name: '内核服务',
    a: ['p-any'],
    b: ['k-service', 'k-types'],
    iface: 'ctx.gwbKernel: GwbKernelApi（dataDir、version、emit、handleRequest、registerImports、setShell）；import type { GwbContext } from 包根',
    convention: false,
    via: 'code',
    text: '内核在根上下文上提供 gwbKernel，先于任何插件、永不撤销，插件直接取、不写进 inject。形状是包根导出的 GwbKernelApi，包根只有类型，插件只 import type。',
  },
  /* ref file="../apps/desktop/src/requests.ts" lines="10-31" hash="2c4f18e7d779" blob="2041dd1920e9" */
  {
    n: 6,
    name: '请求通道',
    a: ['p-provider'],
    b: ['k-requests'],
    iface: 'gwbKernel.handleRequest(channel, handler) → 注销函数；页面 window.gwb.request(channel, payload)',
    convention: false,
    via: 'code',
    text: '提供方插件按通道名登记处理器，同名拒绝，注销函数交给 ctx.effect。页面请求到来时内核按通道找处理器、原样交回结果；没登记就以 GWB_REQUEST_UNAVAILABLE 拒绝。载荷与回执由提供方定义，内核不认识命令。',
  },
  /* ref file="../apps/desktop/src/browser-imports.ts" lines="8-35" hash="632127e56a4b" blob="a9ce57cbee25" */
  {
    n: 7,
    name: '浏览器模块',
    a: ['p-shell'],
    b: ['k-imports'],
    iface: 'gwbKernel.registerImports({ 包名: file:// 地址 }) → 撤销函数；页面 window.gwb.prepareImports(required?)',
    convention: false,
    via: 'code',
    text: '提供方插件（React 由外壳提供）把精确的包名登记到本地 .js 文件，整批原子登记，同名同地址复用、同名不同地址抛错。页面动态 import 之前先 prepareImports，preload 把映射写成 importmap。',
  },
  /* ref file="../apps/desktop/src/api.ts" lines="48-49" hash="ec9ecc8997fe" blob="b2cf0ae6f72c" */
  /* ref file="../apps/desktop/src/index.html" lines="71-86" hash="363477ae4111" blob="27f4d97bcf1c" */
  {
    n: 8,
    name: '外壳接管',
    a: ['p-shell', 'pg-shell'],
    b: ['k-service', 'k-page'],
    iface: 'gwbKernel.setShell(url) → 撤销函数；外壳模块 export default ShellBoot = (root: HTMLElement) => { dispose?() }',
    convention: false,
    via: 'code',
    text: '外壳插件把自己页面模块的地址交给 setShell，后调用的替换先调用的。页面入口 prepareImports 后 import 这个地址，把 #root 交给默认导出；没有外壳、import 失败或默认导出不是函数时显示只读状态页。',
  },
  /* ref file="../apps/desktop/src/api.ts" lines="33-46" hash="37100dff40eb" blob="b2cf0ae6f72c" */
  {
    n: 9,
    name: '页面接口',
    a: ['pg-code', 'pg-shell'],
    b: ['k-preload'],
    iface: 'window.gwb: GwbWindowApi（request、prepareImports、on、onShell）',
    convention: false,
    via: 'code',
    text: '页面上只注入 window.gwb 一个对象，背后是 gwb:request、gwb:imports、gwb:event、gwb:shell、gwb:hello 几个 IPC 通道，两端都在内核包里。内核同时保证页面边界：主框架只能是内核的 index.html，新窗口一律不开，http、https 链接交给系统浏览器。',
  },
  /* ref file="../apps/desktop/src/main.ts" lines="189-196" hash="d00c19984ea4" blob="db3e92ccd653" */
  {
    n: 10,
    name: '写日志',
    a: ['p-any', 'pg-code'],
    b: ['k-log'],
    iface: 'ctx.logger(名字).info / warn / error / debug；页面 console 记成名字 renderer',
    convention: false,
    via: 'code',
    text: '插件、内核自己、页面 console 都写进 cordis 的同一条日志流，内核注册唯一的 exporter，默认收下 info 及以上的每一条，环境变量 GWB_DEBUG 点名的 logger 连 debug 也收。每个插件条目加载成功、加载失败各有一行 loader 日志，条目树安定后写一行汇总。',
  },
  /* ref file="../apps/desktop/src/log-record.ts" lines="28-31" hash="fa06eefeb6ed" blob="9e005a2aef22" */
  {
    n: 11,
    name: 'gwb.log',
    a: ['k-log', 'p-files', 'x-tools'],
    b: ['h-log'],
    iface: '<home>/gwb.log 一行一个 JSON：{ ts, level, source, name, msg }；写满 128 MB 改名为 gwb.log.1',
    convention: false,
    via: 'disk',
    text: '内核把每一条日志写成 gwb.log 里的一行 JSON，五个键、顺序固定；同一条另写一份文本到 stderr。基础界面（logger.query 与日志窗格）、devkit、人按行读这个文件，内核不提供查询。',
  },
  /* ref file="../apps/desktop/src/main.ts" lines="141-158" hash="a7ec7254b2ed" blob="db3e92ccd653" */
  {
    n: 12,
    name: 'runtime.json',
    a: ['k-boot', 'p-files', 'x-tools'],
    b: ['h-runtime'],
    iface: '<home>/runtime.json：{ pid, startedAt, version, cdp? }，每次启动整份重写；MCP 入口补写 mcp',
    convention: true,
    via: 'disk',
    text: '内核每次启动把进程号、启动时刻、版本、调试端口整份写进 runtime.json，退出不删。devkit 与装机 agent 靠它找到运行中的工作台，自己确认进程还在；MCP 入口读出、补上 mcp 再写回。',
  },
  /* ref file="../apps/desktop/package.json" lines="37-43" hash="9afff01b3cb1" blob="df73ceac0ed7" */
  {
    n: 13,
    name: '条目树与包',
    a: ['p-pm'],
    b: ['c-loader', 'h-pkgs'],
    iface: 'ctx.loader 的 create / update / remove / resolve / root；pnpm 改 package.json 与 node_modules',
    convention: false,
    via: 'code',
    text: '插件管理是唯一写 home 的包与条目的插件：改 cordis.yml 只经 loader 的条目树，装包、升级经它运行的 pnpm。条目树的形状由内核带的 loader 与 include 版本决定，换版本就是改接缝。',
  },
];

export const systemGraph = defineSeamGraph({
  id: 'system',
  title: 'gwb 内核仓的包、能力与接缝',
  intro:
    '接缝图：虚线框是本仓的两个包（内核应用、安装包），框里的方块是包对外的能力；cordis 与 loader、cordis.yml 里的插件、页面上的代码、home 里的文件、进程外的工具画在框外。跨框的线带编号就是接缝，实线是代码调用，虚线是读写磁盘上的文件。',
  frameLabel: '包',
  modules,
  entries,
  seams,
});
