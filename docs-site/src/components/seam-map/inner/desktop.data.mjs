/**
 * 内核应用 @godcreator/gwb-kernel-desktop 的内部接缝图：包首页 <SeamMap module="desktop" /> 画的就是它。
 * 虚线框是 apps/desktop/src/ 下的文件或目录（main.ts 按对外能力拆成三个框），方块是它们对外给的函数；
 * 灰色实线框是包外的启动器、Electron、cordis、插件、home 里的文件与页面上的外壳代码。坐标在 desktop.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docfirst-explainer/seam-graph';

export const desktopGraph = defineSeamGraph({
  id: 'desktop',
  title: '内核应用内部的文件与接缝',
  intro:
    '内核应用内部接缝图：上半张是 Electron 主进程（main.ts 与它用到的几个文件），下半张是页面上运行的两个文件 preload.cjs 与 index.html；' +
    '右边一列是 Electron、home 目录里的文件与内核开的窗口。虚线框是包里的文件，main.ts 按对外能力拆成「启动与退出」「内核服务与 IPC」「窗口与页面边界」三个框；' +
    '框里的方块是它们对外给的函数，灰色实线框是包外的东西。插件只经 ctx.gwbKernel 用内核，页面代码只经 window.gwb 用内核，其余都在这个包里面。',
  frameLabel: '文件',
  modules: [
    {
      id: 'launcher',
      name: '启动器',
      pkg: 'apps/launcher（安装包）',
      role: null,
      outside: true,
      blurb:
        '安装版 Electron 的入口，不发 npm 包。它按和内核同一条规则选定 home、把绝对路径写回 GWB_HOME，读 home 里内核包清单的 engines.electron 与 main，Electron 版本在范围里才 import 内核入口。在本仓 pnpm start 时没有它，Electron 直接运行内核。',
      caps: [{ id: 'launch', name: '加载内核', ident: 'import(main)' }],
    },
    {
      id: 'electron',
      name: 'Electron',
      pkg: 'electron',
      role: null,
      outside: true,
      blurb:
        '内核就是这个 Electron 应用。内核用 app 拿单实例锁、等 ready、在 will-quit 里收尾、弹启动失败的错误框；用 BrowserWindow 开唯一的窗口、拦下页面跳转与新窗口。Electron 由安装包提供，版本要在内核包 engines.electron 的范围里。',
      caps: [
        { id: 'app', name: '应用生命周期', ident: 'app' },
        { id: 'bw', name: '窗口', ident: 'BrowserWindow' },
      ],
    },
    {
      id: 'boot',
      name: '启动与退出',
      pkg: 'main.ts',
      role: 'blue',
      outside: false,
      blurb:
        '入口模块求值时做完不需要窗口的部分：选定 home、拿单实例锁、打开 gwb.log、检查 home 里的两个文件、写 runtime.json、建 cordis 实例并提供 gwbKernel；ready 之后开窗口、注册 loader；will-quit 时卸载整棵插件树。检查不通过、ready 之后抛错都走 reportBootFailureAndExit：写一行 error、弹错误框、退出码 1；拿不到锁与 gwb.log 打不开这两处另有写法，见启动与退出页。',
      caps: [
        { id: 'eval', name: '模块求值', ident: '选 home · 锁 · 检查 · runtime.json' },
        { id: 'ready', name: 'ready 之后', ident: 'startAfterAppReady' },
        { id: 'quit', name: '退出', ident: 'dispose → await' },
        { id: 'fail', name: '启动失败', ident: 'reportBootFailureAndExit' },
      ],
    },
    {
      id: 'homefiles',
      name: 'home 里的文件',
      pkg: '<home>/',
      role: null,
      outside: true,
      blurb:
        'home 是磁盘上的一个目录，也是一个 npm 项目根。package.json 与 cordis.yml 由创建 home 的一方准备，之后由插件管理经 pnpm 与条目树改；node_modules 由 pnpm 装；gwb.log 与 runtime.json 由内核写，基础界面、devkit、人与 agent 读。',
      caps: [
        { id: 'rt', name: '运行记录', ident: 'runtime.json' },
        { id: 'yml', name: '清单与条目', ident: 'package.json · cordis.yml' },
        { id: 'nm', name: '装好的包', ident: 'node_modules/' },
        { id: 'logf', name: '日志文件', ident: 'gwb.log · gwb.log.1' },
      ],
    },
    {
      id: 'home',
      name: 'home 与包名解析',
      pkg: 'home-path.ts · bare-import.ts',
      role: 'emerald',
      outside: false,
      blurb:
        'homePathFor 把 GWB_HOME 换成目录：只写名字放在 appData/gwb-kernel/homes/<名字>，带路径分隔符就是目录本身。bareImportFromHome 把包名解析到 home 的 node_modules 里，先 realpath 再解析，运行中换了版本的包拿到的是新文件。',
      caps: [
        { id: 'homepath', name: '选定 home', ident: 'homePathFor' },
        { id: 'bare', name: '按 home 解析包名', ident: 'bareImportFromHome' },
      ],
    },
    {
      id: 'cordis',
      name: 'cordis',
      pkg: 'cordis · plugin-loader · plugin-include',
      role: null,
      outside: true,
      blurb:
        'cordis 写在内核包的 peer 里，由 home 根上唯一的那一份满足，插件用的也是它；loader 与 include 是内核包自己的依赖。Context 提供服务与日志流，loader 管条目树，include 读写 cordis.yml。',
      caps: [
        { id: 'ctx', name: '上下文与日志流', ident: 'Context · logger' },
        { id: 'loader', name: '条目树', ident: 'Loader · Include' },
      ],
    },
    {
      id: 'plugins',
      name: '插件',
      pkg: 'cordis.yml 里的条目',
      role: null,
      outside: true,
      blurb: '所有插件都运行在主进程的 cordis 实例里，apply 拿到的上下文沿父上下文取得到 gwbKernel，不写进 inject。写日志经 ctx.logger。',
      caps: [{ id: 'apply', name: '插件', ident: 'apply(ctx: GwbContext)' }],
    },
    {
      id: 'entries',
      name: '条目状态',
      pkg: 'entry-state.ts · entry-log.ts',
      role: 'amber',
      outside: false,
      blurb:
        'watchEntryStates 监听 cordis 的条目状态变化，每个插件条目挂上（带 apply 耗时）、挂载失败、卸载、退回等待各写一行 loader 日志，条目树安定之后写一行汇总。describeEntry 把一个条目加载到哪一步说成只读状态页上的一句话。',
      caps: [
        { id: 'watch', name: '挂载日志', ident: 'watchEntryStates' },
        { id: 'describe', name: '条目状态', ident: 'describeEntry' },
      ],
    },
    {
      id: 'log',
      name: '日志',
      pkg: 'log-record.ts · log-file.ts',
      role: 'amber',
      outside: false,
      blurb:
        'log-record 定一行的样子：gwb.log 里是一行一个 JSON（ts、level、source、name、msg），终端上是文本；来源按日志名分成内核、插件、页面。log-file 追加写 gwb.log，写到 128 MB 改名为 gwb.log.1 再开新的，启动时打不开就抛错，运行中写不进只告警。',
      caps: [
        { id: 'record', name: '一行的格式', ident: 'fileLineOf' },
        { id: 'file', name: '写入与轮转', ident: 'openLogFile' },
      ],
    },
    {
      id: 'service',
      name: '内核服务与 IPC',
      pkg: 'main.ts',
      role: 'blue',
      outside: false,
      blurb:
        '在 cordis 根上下文提供 gwbKernel（早于任何插件、永不撤销）；注册 gwb:request、gwb:imports、gwb:hello 三个 IPC 处理器；往页面推 gwb:event 与整份外壳状态 gwb:shell；把 cordis 日志流接到 gwb.log 与 stderr。',
      caps: [
        { id: 'svc', name: '内核服务', ident: 'ctx.gwbKernel' },
        { id: 'ipc', name: 'IPC 处理器', ident: 'gwb:request · gwb:imports · gwb:hello' },
        { id: 'push', name: '推给页面', ident: 'gwb:event · gwb:shell' },
        { id: 'exporter', name: '日志出口', ident: 'writeLogLine' },
      ],
    },
    {
      id: 'window',
      name: '窗口与页面边界',
      pkg: 'main.ts · page-boundary.ts',
      role: 'blue',
      outside: false,
      blurb:
        'createMainWindow 开唯一的窗口，preload 指向 preload.cjs，页面是内核包里的 index.html。lockPageToIndexHtml 拦下主框架跳转与重定向（只放行整页重新加载），window.open 一律不开新窗口，http、https 地址交给系统浏览器。',
      caps: [
        { id: 'win', name: '窗口', ident: 'createMainWindow' },
        { id: 'guard', name: '页面边界', ident: 'lockPageToIndexHtml' },
      ],
    },
    {
      id: 'api',
      name: '接口类型',
      pkg: 'api.ts',
      role: 'emerald',
      outside: false,
      blurb: '包根导出的全部接口类型，只有类型、没有运行时代码。main.ts 把内核服务对象标成 GwbKernelApi；插件与页面代码从包根 import type。',
      caps: [
        { id: 'kapi', name: '给插件', ident: 'GwbKernelApi' },
        { id: 'wapi', name: '给页面', ident: 'GwbWindowApi' },
      ],
    },
    {
      id: 'requests',
      name: '请求通道',
      pkg: 'requests.ts',
      role: 'rose',
      outside: false,
      blurb: '通道名到处理器的一张表。同名登记拒绝，注销幂等；页面请求未登记的通道回 available: false，登记了就把处理器的返回值原样带回。内核不解释载荷与回执。',
      caps: [
        { id: 'handle', name: '登记', ident: 'handle' },
        { id: 'dispatch', name: '转交', ident: 'dispatch' },
      ],
    },
    {
      id: 'imports',
      name: '浏览器模块登记',
      pkg: 'browser-imports.ts',
      role: 'cyan',
      outside: false,
      blurb: '包名到本地 .js / .mjs 文件地址的登记表。整批校验后才写入，同名同地址按引用计数复用，不同地址整批拒绝；snapshot 给页面当前的整张表。',
      caps: [
        { id: 'register', name: '登记', ident: 'register' },
        { id: 'snapshot', name: '快照', ident: 'snapshot' },
      ],
    },
    {
      id: 'preload',
      name: 'window.gwb',
      pkg: 'preload.cjs',
      role: 'violet',
      outside: false,
      blurb:
        '在沙箱里的 preload 中运行，只能是 CJS。往页面上放一个 window.gwb，四个成员：request、prepareImports、on、onShell。prepareImports 把主进程的登记表写成页面上的 importmap，同一个页面里已注入的名字不能改绑。',
      caps: [
        { id: 'wreq', name: '请求', ident: 'window.gwb.request' },
        { id: 'prep', name: '准备映射', ident: 'prepareImports' },
        { id: 'subs', name: '订阅', ident: 'on · onShell' },
      ],
    },
    {
      id: 'page',
      name: '页面入口',
      pkg: 'index.html',
      role: 'violet',
      outside: false,
      blurb: '窗口里唯一的页面。订阅外壳状态：没有外壳或外壳启动失败时画只读状态页；有外壳地址就先准备 importmap，再 import 外壳模块，把 #root 交给它的默认导出。',
      caps: [
        { id: 'status', name: '只读状态页', ident: 'showStatusPage' },
        { id: 'mount', name: '挂载外壳', ident: 'mountShell' },
      ],
    },
    {
      id: 'pagecode',
      name: '页面上的外壳与插件代码',
      pkg: '外壳插件 · 窗格插件的浏览器侧',
      role: null,
      outside: true,
      blurb: '外壳插件经 setShell 交出的模块，以及它挂载的窗格插件模块。它们只经 window.gwb 用内核，按包名 import 的模块由 importmap 指到登记方的文件。',
      caps: [
        { id: 'callers', name: '页面代码', ident: 'window.gwb.*' },
        { id: 'shellboot', name: '外壳模块', ident: 'default(root): ShellBoot' },
      ],
    },
  ],
  entries: [{ id: 'user', name: '人 · 开始菜单', to: 'launch' }],
  seams: [
    /* ref file="../apps/launcher/src/main.ts" lines="17-29" hash="0f906fc09c31" blob="f6547781d717" */
    /* ref file="../apps/desktop/package.json" lines="8-8" hash="3f8ef1581707" blob="df73ceac0ed7" */
    /* ref file="../apps/desktop/package.json" lines="37-39" hash="d14faf1367c1" blob="c71ee837c7eb" */
    {
      n: 1,
      name: '加载内核',
      a: ['launch'],
      b: ['eval'],
      iface: 'GWB_HOME（绝对路径）· 内核包清单的 engines.electron 与 main → import(dist/main.js)',
      convention: true,
      via: 'code',
      text:
        '启动器不 import 内核的任何模块，只读 home 里内核包的清单：有 engines.electron、当前 Electron 在范围里、有 main，才 import main 指向的入口，内核从这一刻开始求值。选 home 的规则启动器与内核各写一份，启动器把算出的绝对路径写回 GWB_HOME，内核再选一次一定落在同一个目录。',
    },
    /* ref file="../apps/desktop/src/main.ts" lines="387-389" hash="8e1b809bcbf4" blob="db3e92ccd653" */
    {
      n: 2,
      name: '应用生命周期',
      a: ['eval', 'ready', 'quit', 'fail'],
      b: ['app'],
      iface: "app.requestSingleInstanceLock() · app.whenReady().then(startAfterAppReady) · app.on('will-quit') · dialog.showErrorBox + app.exit(1)",
      convention: false,
      via: 'code',
      text:
        '入口模块求值时拿单实例锁，只把启动注册到 whenReady 上，不能顶层 await：ready 要等入口模块求值完才触发，互相等待会静默卡死。所有窗口关闭就 app.quit()，will-quit 里拦下一次、卸载插件树后再退。启动失败弹错误框、退出码 1。',
    },
    /* ref file="../apps/desktop/src/home-path.ts" hash="482874f47488" blob="8f1ac8757a53" */
    /* ref file="../apps/desktop/src/main.ts" lines="51-55" hash="70afb08b9c0e" blob="db3e92ccd653" */
    {
      n: 3,
      name: '选定 home',
      a: ['eval'],
      b: ['homepath'],
      iface: "homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData')) → realpathSync.native",
      convention: false,
      via: 'code',
      text:
        '目录不存在就创建，再统一成磁盘上的真实路径：大小写、junction、斜杠写法不同的同一个目录得到同一个字符串。Chromium 的 userData 设在 <home>/electron，单实例锁按它区分，所以同一个 home 只运行一个实例、不同 home 可以同时运行。',
    },
    /* ref file="../apps/desktop/src/main.ts" lines="115-120" hash="0066ba403eca" blob="db3e92ccd653" */
    /* ref file="../apps/desktop/src/main.ts" lines="160-164" hash="3c19c4c90a26" blob="db3e92ccd653" */
    {
      n: 4,
      name: '启动时的 home 文件',
      a: ['eval'],
      b: ['yml', 'rt'],
      iface: 'existsSync(package.json · cordis.yml) · writeFileSync(runtime.json, { pid, startedAt, version, cdp? })',
      convention: true,
      via: 'disk',
      text:
        'package.json 与 cordis.yml 缺一个就启动失败，报错写明缺哪个，内核不补。runtime.json 每次启动整份重写，开了调试端口时带 cdp；写不进、端口给的不是 1–65535 的整数都启动失败。退出时不删这份文件，读它的一方自己确认 pid 还活着。',
    },
    /* ref file="../apps/desktop/src/main.ts" lines="361-368" hash="e5fc330ba54d" blob="db3e92ccd653" */
    {
      n: 5,
      name: '注册与卸载 loader',
      a: ['ready', 'quit'],
      b: ['loader'],
      iface: "ctx.plugin(Loader) · loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }]) · loaderFiber.dispose().then(await)",
      convention: false,
      via: 'code',
      text:
        'ready 之后才注册 loader，根层只放一条 id 为 home 的 include 条目，由它读 cordis.yml，所以 cordis.yml 里的条目 id 都是 home:<手写 id>；等 loader.await() 各条目走到终态才写「up」。退出时卸载的就是这个 loader 的 fiber：dispose() 之后还要 await() 才等得到嵌套的异步清理，最多等 5 秒。',
    },
    /* ref file="../apps/desktop/src/bare-import.ts" hash="80b9f6ca2a5a" blob="a03471e3e333" */
    {
      n: 6,
      name: '按 home 解析包名',
      a: ['loader'],
      b: ['bare'],
      iface: 'ctx.loader.internal = { import: bareImportFromHome(dataDir) }',
      convention: false,
      via: 'code',
      text:
        '主进程没有 --expose-internals，loader 默认按自己所在的位置解析包名，插件会静默加载失败；所以加载条目之前先把 internal.import 换成按 home 解析的这一个。它先把 <home>/node_modules/<包名> 解析成真实路径再 createRequire，不命中 Node 为上一版记下的解析缓存。',
    },
    {
      n: 7,
      name: '读 home',
      a: ['loader', 'bare'],
      b: ['yml', 'nm'],
      iface: 'include 读写 cordis.yml · <home>/node_modules/<包名>/package.json',
      convention: true,
      via: 'disk',
      text: 'include 读 cordis.yml、在条目树变化时写回；包名按 home 的 node_modules 找到入口文件。内核不看插件包清单里的任何字段。',
    },
    /* ref file="../apps/desktop/src/api.ts" lines="9-31" hash="4d4da5ce95ba" blob="b2cf0ae6f72c" */
    /* ref file="../apps/desktop/src/main.ts" lines="278-296" hash="a3aef0339ac9" blob="db3e92ccd653" */
    {
      n: 8,
      name: '内核服务',
      a: ['apply'],
      b: ['svc'],
      iface: 'ctx.gwbKernel：dataDir · version · emit · handleRequest · registerImports · setShell',
      convention: false,
      via: 'code',
      text:
        '内核在模块求值时就在根上下文提供它，任何插件加载时都已经在，永不撤销；插件直接取、不写进 inject。handleRequest、registerImports、setShell 返回的撤销函数交给 ctx.effect，插件卸载时自动撤销。',
    },
    /* ref file="../apps/desktop/src/api.ts" lines="33-49" hash="a36c771b7a9e" blob="b2cf0ae6f72c" */
    {
      n: 9,
      name: '接口类型',
      a: ['kapi', 'wapi'],
      b: ['svc', 'apply', 'wreq', 'callers'],
      iface: "import type { GwbContext, GwbWindowApi, ShellBoot } from '@godcreator/gwb-kernel-desktop'",
      convention: false,
      via: 'code',
      text:
        'main.ts 把内核服务对象标成 GwbKernelApi，形状对不上时本仓类型检查失败；插件与页面代码从包根 import type，编译后不留 import。preload.cjs 是 CJS，不经类型检查，window.gwb 的四个成员由 preload.test.ts 核对。',
    },
    /* ref file="../apps/desktop/src/main.ts" lines="189-196" hash="d00c19984ea4" blob="db3e92ccd653" */
    {
      n: 10,
      name: '日志出口',
      a: ['ctx'],
      b: ['exporter'],
      iface: 'ctx.logger.exporter({ levels: fileLogLevels(GWB_DEBUG), export(message) })',
      convention: false,
      via: 'code',
      text:
        '内核在 cordis 日志流上注册唯一的出口：插件、内核、loader 与页面 console 的日志都经它写出，默认只写 info 及以上，环境变量 GWB_DEBUG 点名的 logger 连 debug 也写。每来一条 error 还会排一次外壳状态推送，只读状态页上看得到最近的错误行。',
    },
    /* ref file="../apps/desktop/src/log-record.ts" lines="28-35" hash="6ea79d3dce38" blob="9e005a2aef22" */
    {
      n: 11,
      name: '写一行',
      a: ['exporter'],
      b: ['record', 'file'],
      iface: '{ ts, level, source, name, msg } → terminalLineOf → stderr · fileLineOf → logFile.write',
      convention: false,
      via: 'code',
      text: '同一条记录写两份：stderr 上是一行文本，gwb.log 里是一行 JSON。没有终端时写 stderr 会抛 EPIPE，内核在模块求值时就给 stderr 加了吞掉错误的监听，文件照常写。',
    },
    {
      n: 12,
      name: 'gwb.log',
      a: ['file'],
      b: ['logf'],
      iface: '<home>/gwb.log（一行一个 JSON）· 写满 128 MB 改名为 gwb.log.1',
      convention: true,
      via: 'disk',
      text: '基础界面、devkit 自己拼出 <home>/gwb.log 读，不问内核；一行的五个键与顺序就是它们依赖的格式。',
    },
    /* ref file="../apps/desktop/src/entry-log.ts" lines="113-120" hash="2324fab99fe1" blob="9c2a0bc85145" */
    {
      n: 13,
      name: '条目状态变化',
      a: ['ctx'],
      b: ['watch'],
      iface: "ctx.on('internal/status', (fiber, oldState)) · ctx.on('loader/entry-init') → ctx.logger('loader')",
      convention: false,
      via: 'code',
      text:
        'include 与分组条目只是装条目的容器，插件里再 ctx.plugin 出来的子 fiber 也不算条目。一开始就缺服务的条目不发任何状态变化，只能靠汇总报出来。退出时先停掉它，卸载整棵树时不逐条写。',
    },
    /* ref file="../apps/desktop/src/main.ts" lines="230-239" hash="c4235b59edd3" blob="db3e92ccd653" */
    {
      n: 14,
      name: '状态页数据',
      a: ['describe'],
      b: ['push'],
      iface: '{ home, entries: [{ id, name, state: describeEntry(entry) }], errors: 最近 20 行 error 与 warn }',
      convention: false,
      via: 'code',
      text: '外壳状态 gwb:shell 里除了 url 还带这份 report，只给内核自己的页面入口画只读状态页用，不在 GwbWindowApi 里。条目状态变化、每来一行 error、loader 加载完都会重新推一次，200 毫秒内的多次合并成一次。',
    },
    /* ref file="../apps/desktop/src/requests.ts" hash="17ba3b7ad9e6" blob="2041dd1920e9" */
    {
      n: 15,
      name: '请求通道',
      a: ['svc', 'ipc'],
      b: ['handle', 'dispatch'],
      iface: "handleRequest(channel, handler) → requests.handle · ipcMain.handle('gwb:request') → requests.dispatch → { available, value }",
      convention: false,
      via: 'code',
      text:
        'available 是传输状态，跟处理器的返回值隔开：未登记的通道回 available: false，页面侧变成 GWB_REQUEST_UNAVAILABLE 拒绝；登记了就原样带回返回值，处理器抛错时页面的请求照常拒绝。注销不取消已经开始的请求。',
    },
    /* ref file="../apps/desktop/src/browser-imports.ts" hash="1cdc46619f34" blob="a9ce57cbee25" */
    {
      n: 16,
      name: '浏览器模块登记',
      a: ['svc', 'ipc'],
      b: ['register', 'snapshot'],
      iface: "registerImports(imports) → browserImports.register · ipcMain.handle('gwb:imports') → snapshot()",
      convention: false,
      via: 'code',
      text: '名字要是精确的包名或子路径，地址要是本地 .js 或 .mjs 的 file: 地址；一批里有一个不合格或冲突，整批都不登记。撤销只从主进程的表里减掉，已经注入页面的映射不会跟着撤销。',
    },
    /* ref file="../apps/desktop/src/main.ts" lines="321-339" hash="9438488c6351" blob="db3e92ccd653" */
    {
      n: 17,
      name: '窗口与页面边界',
      a: ['win', 'guard'],
      b: ['bw'],
      iface: "new BrowserWindow({ show: false, webPreferences: { preload } }) · will-navigate · will-redirect · setWindowOpenHandler → { action: 'deny' }",
      convention: false,
      via: 'code',
      text:
        '页面能调用插件登记的所有请求通道，所以主框架只能是内核的 index.html：跳到别处、主框架重定向一律拒绝并记一行 warn，只放行整页重新加载；开新窗口一律拒绝，http、https 地址交给系统浏览器。IPC 处理器也只接收顶层框架的调用。',
    },
    /* ref file="../apps/desktop/src/main.ts" lines="352-354" hash="cb8cdc7db26f" blob="db3e92ccd653" */
    {
      n: 18,
      name: '页面 console',
      a: ['win'],
      b: ['exporter'],
      iface: "webContents.on('console-message') → ctx.logger('renderer')[级别]",
      convention: false,
      via: 'code',
      text: '页面上的 console 输出转成名字为 renderer 的 cordis 日志，Electron 的 warning 记成 warn，gwb.log 里来源是 renderer。',
    },
    /* ref file="../apps/desktop/src/preload.cjs" lines="37-51" hash="2b2f25edc1e5" blob="97b2299ef0dc" */
    {
      n: 19,
      name: 'IPC 通道',
      a: ['wreq', 'prep', 'subs'],
      b: ['ipc', 'push'],
      iface: "invoke('gwb:request', channel, payload) · invoke('gwb:imports') · on('gwb:event') · on('gwb:shell') · send('gwb:hello')",
      convention: false,
      via: 'code',
      text:
        '两端都在内核包里，通道名不导出，页面代码只经 window.gwb 用它们。onShell 订阅之后马上发一次 gwb:hello 问当前值：外壳插件可能在页面就位之前就调过 setShell。gwb:event 只发给当前窗口，窗口不在就丢掉。',
    },
    /* ref file="../apps/desktop/src/index.html" lines="71-110" hash="6baff500566e" blob="27f4d97bcf1c" */
    {
      n: 20,
      name: '页面入口用 window.gwb',
      a: ['status', 'mount'],
      b: ['subs', 'prep'],
      iface: 'window.gwb.onShell(({ url, report }) => …) · await window.gwb.prepareImports() → import(url)',
      convention: false,
      via: 'code',
      text:
        '推来 url: null 就画只读状态页；推来外壳地址就先等 importmap 注入，再 import。同一个地址在 import 完成前又推来一次不重复挂载；已注入的映射变了时 prepareImports 以 GWB_IMPORTS_RELOAD_REQUIRED 拒绝，状态页提示整页重载，不记成启动故障。',
    },
    /* ref file="../apps/desktop/src/api.ts" lines="48-49" hash="ec9ecc8997fe" blob="b2cf0ae6f72c" */
    {
      n: 21,
      name: '外壳模块',
      a: ['mount'],
      b: ['shellboot'],
      iface: 'import(url) → default(#root) → { dispose? }',
      convention: false,
      via: 'code',
      text:
        '内核只认这个默认导出的形状，不认识外壳里的任何东西。换外壳时先调旧外壳的 dispose，紧接着清空 #root，再挂载新的；默认导出不是函数、import 失败都回到只读状态页，第一句带着原因。',
    },
    {
      n: 22,
      name: '页面代码用 window.gwb',
      a: ['callers'],
      b: ['wreq', 'prep', 'subs'],
      iface: 'window.gwb.request(channel, payload) · prepareImports(required?) · on(cb)',
      convention: false,
      via: 'code',
      text:
        '外壳与窗格插件在页面上调插件登记的请求通道、收插件 emit 的事件；动态 import 登记过的包名之前先 prepareImports，可以点名必须已登记的名字。页面上运行的任何代码都能调用 window.gwb，内核只靠页面边界限制谁能在这个页面上运行。',
    },
  ],
});
