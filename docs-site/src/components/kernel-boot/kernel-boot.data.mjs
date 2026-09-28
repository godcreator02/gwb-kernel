/**
 * 「内核一次启动」的讲解数据：画面（kernel-boot.tsx）与机读版规则（kernel-boot.ai.mjs）都只读这一份。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、个别参与者此刻的副标题、对应哪段源码。
 * 源码片段照抄 apps/，正上方的记号把它钉在源码上。
 */

/**
 * 参与者：内核的 main.ts 是蓝色，页面是紫色，home 里的文件是绿色，包外的启动器、Electron、cordis、插件、外壳是灰色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/docfirst-explainer').Role }[]}
 */
export const actors = [
  { id: 'launcher', name: '启动器', sub: 'apps/launcher', role: 'slate' },
  { id: 'eval', name: '入口模块求值', sub: 'main.ts 顶层', role: 'blue' },
  { id: 'ready', name: 'ready 之后', sub: 'startAfterAppReady', role: 'blue' },
  { id: 'electron', name: 'Electron', sub: 'app', role: 'slate' },
  { id: 'cordis', name: 'cordis 根上下文', sub: 'ctx', role: 'slate' },
  { id: 'loader', name: 'loader + include', sub: 'ctx.loader', role: 'slate' },
  { id: 'plugins', name: '插件', sub: 'apply(ctx)', role: 'slate' },
  { id: 'window', name: '窗口', sub: 'BrowserWindow', role: 'blue' },
  { id: 'page', name: '页面', sub: 'index.html', role: 'violet' },
  { id: 'shell', name: '外壳模块', sub: 'setShell 交出的地址', role: 'slate' },
  { id: 'log', name: 'gwb.log', sub: '一行一个 JSON', role: 'emerald' },
  { id: 'files', name: 'home 的两个文件', sub: 'package.json · cordis.yml', role: 'emerald' },
  { id: 'rt', name: 'runtime.json', sub: 'pid · version · cdp', role: 'emerald' },
  { id: 'nm', name: 'node_modules', sub: '内核包 · cordis · 插件', role: 'emerald' },
];

/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} BootStep
 * @type {BootStep[]}
 */
export const steps = [
  /* ref file="../apps/launcher/src/main.ts" lines="17-29" hash="0f906fc09c31" blob="f6547781d717" */
  {
    title: '启动器找到内核',
    text:
      '从安装版启动时，Electron 先运行启动器：它按 GWB_HOME 选定 home（不设就是 default），把绝对路径写回 GWB_HOME；再读 home 里内核包的清单，' +
      'Electron 版本在 engines.electron 的范围里、清单写了 main，才 import 这个入口。不满足就弹框、退出码 1，内核一行都不运行。' +
      '在本仓 pnpm start 时没有这一步，Electron 直接运行内核入口。',
    lit: ['launcher', 'nm', 'eval'],
    shown: ['manifest', 'import'],
    marks: { launcher: 'GWB_HOME → 绝对路径' },
    code: {
      file: 'apps/launcher/src/main.ts',
      start: 17,
      lines: [
        "const homeDir = homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData'))",
        '// 内核启动时按同一条规则再选一次 home；给它绝对路径，两边一定是同一个目录',
        'process.env.GWB_HOME = homeDir',
        '',
        'const kernel = kernelEntryFor(homeDir, electronVersion)',
        'if (kernel.ok) {',
        '  // 不能顶层 await：入口模块求值完 Electron 才触发 ready，内核模块求值时只把启动注册到 whenReady',
        '  import(pathToFileURL(kernel.entryFile).href).catch((err: unknown) => {',
        '    fail(`内核启动失败：${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)',
        '  })',
        '} else {',
        '  fail(kernel.message)',
        '}',
      ],
      highlight: [21, 24],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="51-58" hash="f6dd84bfa472" blob="db3e92ccd653" */
  {
    title: '模块求值：选定 home、拿锁、打开日志',
    text:
      '内核入口开始求值，先按同一条规则再选一次 home：目录不存在就创建，路径统一成磁盘上的真实路径，Chromium 的 userData 设在 <home>/electron。' +
      '然后拿单实例锁、打开 gwb.log。锁按 userData 区分：同一个 home 已有实例在运行时，新实例写一行 error、退出码 1，已在运行的那个把窗口调到前面。' +
      'stderr 在这里加上吞掉错误的监听：没有终端时每写一次 stderr 都抛 EPIPE。',
    lit: ['eval', 'electron', 'log'],
    shown: ['lock', 'openlog'],
    marks: { eval: 'home = realpath(…)' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 50,
      lines: [
        "const homePath = homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData'))",
        'fs.mkdirSync(homePath, { recursive: true })',
        '// 单实例锁按 userData 区分：同一个 home 的不同写法（大小写、junction、斜杠）必须 realpath 成同一个字符串',
        'const dataDir = fs.realpathSync.native(homePath)',
        "app.setPath('userData', path.join(dataDir, 'electron'))",
        '',
        '// 没有终端时每写一次 stderr 都抛 EPIPE，忽略它，日志文件照常写',
        "process.stderr.on('error', () => {})",
      ],
      highlight: [53, 54],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="160-164" hash="3c19c4c90a26" blob="db3e92ccd653" */
  {
    title: '模块求值：检查 home 的两个文件，写 runtime.json',
    text:
      'home 里缺 package.json 或 cordis.yml 就启动失败，报错写明缺哪个：这两个文件由安装步骤或 devkit.home.new 准备，内核不补。' +
      '接着整份重写 runtime.json：pid、启动时刻、内核版本，开了 --remote-debugging-port 时还有 cdp。端口给的不是 1–65535 的整数、文件写不进，都启动失败。',
    lit: ['eval', 'files', 'rt'],
    shown: ['check', 'writert'],
    marks: {},
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 147,
      lines: [
        '// 没给这个开关时是空串',
        "const debuggingPortSwitch = app.commandLine.getSwitchValue('remote-debugging-port')",
        "if (debuggingPortSwitch === '') writeRuntimeRecord(undefined)",
        'else if (isPortNumber(debuggingPortSwitch)) writeRuntimeRecord(Number(debuggingPortSwitch))',
        'else reportBootFailureAndExit(`--remote-debugging-port 给的是 ${JSON.stringify(debuggingPortSwitch)}，不是 1–65535 的整数`)',
      ],
      highlight: [149, 151],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="278-296" hash="a3aef0339ac9" blob="db3e92ccd653" */
  {
    title: '模块求值：建 cordis 实例，提供 gwbKernel',
    text:
      '建 cordis 的根上下文，baseUrl 设到 home，loader 与 include 从这里找 cordis.yml；在日志流上注册唯一的出口，注册未捕获异常与 rejection 的监听。' +
      '然后提供 gwbKernel，注册 gwb:request、gwb:imports、gwb:hello 三个 IPC 处理器。这些都在模块求值时完成，所以任何插件加载时 gwbKernel 都已经在了。',
    lit: ['eval', 'cordis'],
    shown: ['provide'],
    marks: { cordis: 'gwbKernel · 日志出口' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 266,
      lines: [
        'const browserImports = createBrowserImports()',
        'const requests = createRequests()',
        'const kernel: GwbKernelApi = {',
        '  dataDir,',
        '  version: kernelVersion,',
        "  emit: (payload) => mainWindow?.webContents.send('gwb:event', payload),",
        '  handleRequest: (channel, handler) => requests.handle(channel, handler),',
        '  registerImports: (imports) => browserImports.register(imports),',
        '  setShell: (url) => {',
        '    currentShellUrl = url',
        '    pushShellMessageNow()',
        '    return () => {',
        '      if (currentShellUrl !== url) return',
        '      currentShellUrl = null',
        '      pushShellMessageNow()',
        '    }',
        '  },',
        '}',
        "ctx.provide('gwbKernel', kernel)",
      ],
      highlight: [284, 284],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="387-389" hash="8e1b809bcbf4" blob="db3e92ccd653" */
  {
    title: '入口模块求值完，Electron 触发 ready',
    text:
      '入口的最后只把启动注册到 whenReady 上，出错交给 reportBootFailureAndExit。不能顶层 await app.whenReady()：Electron 要等入口模块求值完才触发 ready，' +
      '顶层等它就互相等待，进程静默卡住，没有报错、没有窗口、没有日志。',
    lit: ['eval', 'electron', 'ready'],
    shown: ['whenready'],
    marks: { eval: '求值完', ready: '开始执行' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 375,
      lines: [
        '// 不能顶层 await：Electron 的 ready 要等入口模块求值完才触发，顶层等 ready 会互相等待、卡死',
        'void app.whenReady().then(startAfterAppReady).catch(reportBootFailureAndExit)',
        "app.on('window-all-closed', () => app.quit())",
      ],
      highlight: [376, 376],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="370-378" hash="3a901e174df6" blob="db3e92ccd653" */
  {
    title: 'ready 之后：开窗口，页面先显示只读状态页',
    text:
      '去掉 Electron 默认的那套菜单，开唯一的窗口：先不显示，ready-to-show 之后才显示，窗口底色与页面背景同色，不闪白。然后加载内核包里的 index.html。' +
      '这时一个插件都还没加载，页面订阅外壳状态收到 url: null，显示只读状态页。窗口先于 loader：插件加载的过程中页面就在，页面的 console 也从一开始就进日志。',
    lit: ['ready', 'window', 'page'],
    shown: ['openwin', 'winpage'],
    marks: { page: '只读状态页' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 358,
      lines: [
        'async function startAfterAppReady(): Promise<void> {',
        '  // 不设的话 Electron 给一套默认菜单（File/Edit/View/Window）',
        '  Menu.setApplicationMenu(null)',
        '  mainWindow = createMainWindow()',
        "  await mainWindow.loadFile(path.join(moduleDir, 'index.html'))",
        '  await loadPluginsFromHome()',
        "  kernelLog.info(`up，home=${dataDir}，外壳=${currentShellUrl ?? '（没有插件调用 setShell）'}`)",
        '  scheduleShellPush()',
        '}',
      ],
      highlight: [360, 362],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="361-368" hash="e5fc330ba54d" blob="db3e92ccd653" */
  {
    title: 'ready 之后：注册 loader，按 cordis.yml 加载插件',
    text:
      '注册 loader，先把 internal.import 换成按 home 解析包名的 bareImportFromHome：不设的话 loader 按自己所在的位置解析包名，插件静默加载失败。' +
      '再在根层放一条 id 为 home 的 include 条目，由它读 cordis.yml、逐条加载；包名解析到 home 的 node_modules，插件 apply 拿到的上下文里已经有 gwbKernel。',
    lit: ['ready', 'loader', 'files', 'nm', 'plugins'],
    shown: ['plugloader', 'readyml', 'resolve', 'apply'],
    marks: { loader: '根条目 home' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 349,
      lines: [
        'async function loadPluginsFromHome(): Promise<void> {',
        '  loaderFiber = await ctx.plugin(Loader, {})',
        '  // 主进程没有 --expose-internals，不设 internal 的话 loader 按自己的位置解析包名，插件静默加载失败',
        '  ctx.loader.internal = { import: bareImportFromHome(dataDir) } as unknown as ModuleLoader',
        '  ctx.loader.builtins.include = Include',
        "  await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])",
        '  await ctx.loader.await()',
        '}',
      ],
      highlight: [352, 354],
    },
  },
  /* ref file="../apps/desktop/src/index.html" lines="71-79" hash="b6bdfa89f864" blob="27f4d97bcf1c" */
  {
    title: '外壳插件调 setShell，页面交给外壳',
    text:
      '加载途中，外壳插件调 gwbKernel.setShell(url)，内核立刻往页面推整份外壳状态。页面先等 importmap 注入（prepareImports），再 import 这个地址，' +
      '把 #root 交给它的默认导出。外壳 import 失败、默认导出不是函数，页面回到只读状态页，第一句写原因。',
    lit: ['plugins', 'page', 'shell'],
    shown: ['setshell', 'mountshell'],
    marks: { page: 'prepareImports → import(url)', shell: 'default(#root)' },
    code: {
      file: 'apps/desktop/src/index.html',
      start: 71,
      lines: [
        '      async function mountShell(url, report, generation) {',
        '        try {',
        '          await window.gwb.prepareImports()',
        '          if (generation !== shellGeneration) return',
        '          const shellModule = await import(url)',
        '          if (generation !== shellGeneration) return',
        "          if (typeof shellModule.default !== 'function') throw new Error(`${url} 的默认导出不是函数`)",
        '          currentShell = { url, handle: shellModule.default(root) ?? null }',
        '        } catch (err) {',
      ],
      highlight: [73, 78],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="370-378" hash="3a901e174df6" blob="db3e92ccd653" */
  {
    title: 'loader 加载完：写「up」，再推一次状态',
    text:
      '等 loader.await() 让各条目走到各自的终态，才写 up 那一行（带 home 路径与外壳地址），再推一次整份外壳状态；没有外壳时，只读状态页据此重画条目表。' +
      '之后条目的每次状态变化、每一行 error 都会触发推送，200 毫秒内的多次合并成一次。',
    lit: ['ready', 'log', 'page'],
    shown: ['up'],
    marks: { log: 'info kernel up，home=…' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 358,
      lines: [
        'async function startAfterAppReady(): Promise<void> {',
        '  // 不设的话 Electron 给一套默认菜单（File/Edit/View/Window）',
        '  Menu.setApplicationMenu(null)',
        '  mainWindow = createMainWindow()',
        "  await mainWindow.loadFile(path.join(moduleDir, 'index.html'))",
        '  await loadPluginsFromHome()',
        "  kernelLog.info(`up，home=${dataDir}，外壳=${currentShellUrl ?? '（没有插件调用 setShell）'}`)",
        '  scheduleShellPush()',
        '}',
      ],
      highlight: [363, 365],
    },
  },
];
