/**
 * 「从 GWB_HOME 到插件加载成功」的讲解数据：画面（home-load.tsx）与机读版规则（home-load.ai.mjs）都只读这一份。
 * 例子是一个名叫 demo 的 home，cordis.yml 里两条条目；每一步是一个固定状态：磁盘上亮哪几行、条目树长成什么样、对应哪段源码。
 * 源码片段照抄 apps/desktop/，正上方的记号把它钉在源码上；版本号 1.0.0 / 1.1.0 是示例。
 */

/**
 * 磁盘上 home 目录里讲解要用到的几行。`depth` 是缩进层级，`target` 是 junction 指向（pnpm 布局）。
 * @type {{ id: string, name: string, depth: number, note: string }[]}
 */
export const diskLines = [
  { id: 'home', name: '%APPDATA%\\gwb-kernel\\homes\\demo\\', depth: 0, note: 'home 目录，路径统一成真实路径' },
  { id: 'pkg', name: 'package.json', depth: 1, note: '包清单：内核包、cordis、各插件' },
  { id: 'yml', name: 'cordis.yml', depth: 1, note: '条目清单' },
  { id: 'runtime', name: 'runtime.json', depth: 1, note: '这次运行的 pid、启动时刻、版本' },
  { id: 'log', name: 'gwb.log', depth: 1, note: '日志' },
  { id: 'electron', name: 'electron\\', depth: 1, note: 'Chromium 的 userData，单实例锁按它区分' },
  { id: 'nm', name: 'node_modules\\', depth: 1, note: 'pnpm 装的包' },
  { id: 'cordis', name: 'cordis', depth: 2, note: '→ .pnpm\\cordis@4.0.0-rc.10\\…' },
  { id: 'kernel', name: '@godcreator\\gwb-kernel-desktop', depth: 2, note: '→ .pnpm\\…（内核包自己）' },
  { id: 'shell', name: '@godcreator\\gwb-shell', depth: 2, note: '→ .pnpm\\@godcreator+gwb-shell@1.0.0\\…' },
];

/** 第 8 步 junction 改指之后，外壳包那一行的指向 */
export const shellUpgradedNote = '→ .pnpm\\@godcreator+gwb-shell@1.1.0\\…';

/**
 * 条目树里的一个节点。`state` 用 cordis 的状态原名，还没有 fiber 时写 import 进行到哪
 * @typedef {{ id: string, name: string, depth: number, state: string, tone: 'good' | 'warn' | 'bad' | 'pending' | 'info' }} TreeNode
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number], example?: boolean }} Code
 * @typedef {{ title: string, text: string, diskLit: string[], shellNote?: string, tree: TreeNode[], code: Code }} LoadStep
 */

/** @type {LoadStep[]} */
export const steps = [
  /* ref file="../apps/desktop/src/main.ts" lines="50-54" hash="70afb08b9c0e" blob="b613d37fa683" */
  {
    title: '选定 home',
    text:
      '环境变量 GWB_HOME 写的是 demo（只有名字、不带路径分隔符），home 就是 appData 下的 gwb-kernel\\homes\\demo；带分隔符时就是那个目录，不设时是 default。' +
      '目录不存在就创建，再 realpath 成磁盘上的真实路径：大小写、junction、斜杠写法不同的同一个目录得到同一个字符串，单实例锁才认得出「同一个 home」。' +
      'Chromium 的 userData 设在 <home>\\electron，每个 home 一份。',
    diskLit: ['home', 'electron'],
    tree: [],
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 50,
      lines: [
        "const homePath = homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData'))",
        'fs.mkdirSync(homePath, { recursive: true })',
        '// 单实例锁按 userData 区分：同一个 home 的不同写法（大小写、junction、斜杠）必须 realpath 成同一个字符串',
        'const dataDir = fs.realpathSync.native(homePath)',
        "app.setPath('userData', path.join(dataDir, 'electron'))",
      ],
      highlight: [53, 54],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="114-119" hash="0066ba403eca" blob="b613d37fa683" */
  {
    title: '检查两个文件，缺了就停',
    text:
      '打开 gwb.log、拿到单实例锁之后，内核检查 home 里有没有 package.json 与 cordis.yml。缺哪个都启动失败：错误框与日志写明缺哪个、home 在哪，退出码 1。' +
      '这两个文件由安装步骤（INSTALL.md）或 devkit.home.new 准备，内核只检查、不补，也不改它们的内容。',
    diskLit: ['pkg', 'yml', 'log'],
    tree: [],
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 114,
      lines: [
        'const missingHomeFiles = HOME_FILES_REQUIRED_AT_BOOT.filter((file) => !fs.existsSync(path.join(dataDir, file)))',
        'if (missingHomeFiles.length > 0) {',
        '  reportBootFailureAndExit(',
        '    `home ${dataDir} 里缺 ${missingHomeFiles.join(\'、\')}。package.json 与 cordis.yml 由安装步骤（INSTALL.md）或 devkit.home.new 准备，内核不补`,',
        '  )',
        '}',
      ],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="138-151" hash="02c2df3340c0" blob="b613d37fa683" */
  {
    title: '整份重写 runtime.json',
    text:
      '还没创建 cordis 实例，内核先把这次运行的 pid、启动时刻、版本写进 <home>\\runtime.json；命令行带了 --remote-debugging-port 时再加一个 cdp。' +
      '上一次运行留下的内容整份覆盖。写不进、端口不是 1–65535 的整数，都启动失败。',
    diskLit: ['runtime'],
    tree: [],
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 138,
      lines: [
        'function writeRuntimeRecord(debuggingPort: number | undefined): void {',
        "  const runtimeFile = path.join(dataDir, 'runtime.json')",
        '  try {',
        "    fs.writeFileSync(runtimeFile, JSON.stringify(runtimeRecord(debuggingPort), null, 2) + '\\n')",
        '  } catch (err) {',
        '    reportBootFailureAndExit(`runtime.json 写入失败（${runtimeFile}）：${stackOf(err)}`)',
        '  }',
        '}',
        '',
        '// 没给这个开关时是空串',
        "const debuggingPortSwitch = app.commandLine.getSwitchValue('remote-debugging-port')",
        "if (debuggingPortSwitch === '') writeRuntimeRecord(undefined)",
        'else if (isPortNumber(debuggingPortSwitch)) writeRuntimeRecord(Number(debuggingPortSwitch))',
        'else reportBootFailureAndExit(`--remote-debugging-port 给的是 ${JSON.stringify(debuggingPortSwitch)}，不是 1–65535 的整数`)',
      ],
      highlight: [141, 141],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="349-356" hash="e5fc330ba54d" blob="b613d37fa683" */
  {
    title: 'loader 的根层只放一条 include 条目',
    text:
      '窗口加载完页面之后，内核在根上下文上加载 cordis 官方的 loader，并在加载第一条条目之前设好两样：internal.import 换成按 home 解析包名，include 经 builtins 交给 loader。' +
      '然后根层只放一条条目：id 固定是 home、name 是 cordis:include、读 cordis.yml。模块解析起点 ctx.baseUrl 早已设成 home 的 file: 地址，loader 与 include 都从根上下文继承它。',
    diskLit: [],
    tree: [{ id: 'home', name: 'cordis:include', depth: 0, state: 'LOADING', tone: 'pending' }],
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
  {
    title: 'include 读 cordis.yml，长出子条目',
    text:
      'include 从 home 读 cordis.yml，每一条变成 home 下面的一个子条目，完整 id 是 home:<手写 id>。' +
      '数据插件、设置插件按这个 id 的末段算自己的目录与分区，所以根层那条的 id 必须固定是 home：不固定的话父 id 每次启动随机，所有条目的 id 跟着变。',
    diskLit: ['yml'],
    tree: [
      { id: 'home', name: 'cordis:include', depth: 0, state: 'ACTIVE', tone: 'good' },
      { id: 'home:commands', name: '@godcreator/gwb-commands', depth: 1, state: 'import 中', tone: 'pending' },
      { id: 'home:shell', name: '@godcreator/gwb-shell', depth: 1, state: 'import 中', tone: 'pending' },
    ],
    code: {
      file: 'cordis.yml',
      start: 1,
      example: true,
      lines: ['- id: commands', "  name: '@godcreator/gwb-commands'", '- id: shell', "  name: '@godcreator/gwb-shell'"],
    },
  },
  /* ref file="../apps/desktop/src/bare-import.ts" lines="6-18" hash="c30f3452be03" blob="a03471e3e333" */
  {
    title: '按 home 解析包名',
    text:
      'loader 要 import「@godcreator/gwb-shell」时调用内核给的 internal.import：先把 <home>\\node_modules\\@godcreator\\gwb-shell 这个 junction realpath 成 .pnpm 下带版本号的真实目录，' +
      '再从那里按 require.resolve 的规则读包清单的 exports 找到入口文件，最后按 ESM import。包名只从 home 找，不从内核包自己的目录找。',
    diskLit: ['nm', 'shell'],
    tree: [
      { id: 'home', name: 'cordis:include', depth: 0, state: 'ACTIVE', tone: 'good' },
      { id: 'home:commands', name: '@godcreator/gwb-commands', depth: 1, state: 'import 中', tone: 'pending' },
      { id: 'home:shell', name: '@godcreator/gwb-shell', depth: 1, state: 'import 中', tone: 'pending' },
    ],
    code: {
      file: 'apps/desktop/src/bare-import.ts',
      start: 6,
      lines: [
        '/**',
        ' * 把 home 里的包名解析成主入口的文件路径。',
        ' * 必须先 realpath 再从真实目录解析：Node 的 CJS 解析缓存按「请求名 + 起点」记，逻辑路径不变时会返回上一版的文件',
        ' */',
        'function resolveFromHome(dataDir: string, packageName: string): string {',
        "  const realPackageDir = fs.realpathSync.native(path.join(dataDir, 'node_modules', ...packageName.split('/')))",
        "  return createRequire(path.join(realPackageDir, 'package.json')).resolve(packageName)",
        '}',
        '',
        '/** 给 cordis loader 当 `internal.import` 用：按 home 解析包名，再按 ESM import */',
        'export function bareImportFromHome(dataDir: string): (packageName: string) => Promise<unknown> {',
        '  return (packageName) => import(pathToFileURL(resolveFromHome(dataDir, packageName)).href)',
        '}',
      ],
      highlight: [16, 17],
    },
  },
  /* ref file="../apps/desktop/src/entry-log.ts" lines="96-111" hash="0a1e53ec6504" blob="9c2a0bc85145" */
  {
    title: 'inject 齐了才 apply，进了 ACTIVE 才算加载成功',
    text:
      'import 拿到入口导出之后，cordis 等插件 inject 里的服务都在了才调用 apply；异步的 apply 完成那一刻条目才进 ACTIVE。fiber 存在不等于加载成功：缺服务的条目停在 PENDING，不报错。' +
      '内核按条目在 gwb.log 里写一行 loader 日志——加载成功（带 apply 耗时）、挂载失败、卸载、退回等待——条目树安定之后再写一行汇总，列出在等的、失败的、没导入成功的。',
    diskLit: ['log'],
    tree: [
      { id: 'home', name: 'cordis:include', depth: 0, state: 'ACTIVE', tone: 'good' },
      { id: 'home:commands', name: '@godcreator/gwb-commands', depth: 1, state: 'ACTIVE', tone: 'good' },
      { id: 'home:shell', name: '@godcreator/gwb-shell', depth: 1, state: 'ACTIVE', tone: 'good' },
    ],
    code: {
      file: 'apps/desktop/src/entry-log.ts',
      start: 96,
      lines: [
        '  function logTransition(fiber: Fiber, entry: Entry, oldState: number): void {',
        '    const name = entry.options.name',
        '    const condition = conditionOfFiber(fiber as unknown as FiberInternals)',
        '    if (fiber.state === LOADING) {',
        '      loadingSince.set(fiber, performance.now())',
        '    } else if (fiber.state === ACTIVE) {',
        '      const applyMs = Math.round(performance.now() - (loadingSince.get(fiber) as number))',
        '      log.info(`${name} 挂上了（apply ${applyMs} ms）`)',
        "    } else if (condition.kind === 'failed') {",
        '      log.error(`${name} 挂载失败：${condition.firstErrorLine}`)',
        '    } else if (fiber.state === DISPOSED) {',
        '      log.info(`${name} 已卸载`)',
        "    } else if (condition.kind === 'pending' && oldState !== PENDING) {",
        "      log.info(`${name} 退回等待：缺 ${condition.missingServices.join('、')}`)",
        '    }',
        '  }',
      ],
      highlight: [101, 103],
    },
  },
  /* ref file="../apps/desktop/tests/bare-import.test.ts" lines="62-72" hash="b9ca154a8aad" blob="205f23de64b1" */
  {
    title: '换了版本，停用再启用就拿到新代码',
    text:
      '插件管理用 pnpm 把 gwb-shell 升到 1.1.0，node_modules 里那个 junction 改指 .pnpm 下 1.1.0 的目录。条目停用再启用，loader 重新调用 internal.import：' +
      '因为先 realpath，这次的起点是带 1.1.0 的新目录，不会命中 Node 为 1.0.0 记下的解析缓存，import 进来的是新代码，不用重启工作台。测试在临时目录里照 pnpm 布局换 junction 验证这一点。',
    diskLit: ['shell'],
    shellNote: shellUpgradedNote,
    tree: [
      { id: 'home', name: 'cordis:include', depth: 0, state: 'ACTIVE', tone: 'good' },
      { id: 'home:commands', name: '@godcreator/gwb-commands', depth: 1, state: 'ACTIVE', tone: 'good' },
      { id: 'home:shell', name: '@godcreator/gwb-shell', depth: 1, state: 'ACTIVE（1.1.0）', tone: 'info' },
    ],
    code: {
      file: 'apps/desktop/tests/bare-import.test.ts',
      start: 62,
      lines: [
        "    const home = makeHome({ ...layout('1.0.0', 'v1'), ...layout('2.0.0', 'v2') })",
        "    const link = path.join(home, 'node_modules', 'current')",
        '    fs.mkdirSync(path.dirname(link), { recursive: true })',
        "    fs.symlinkSync(path.join(home, '.pnpm', 'current@1.0.0', 'node_modules', 'current'), link, 'junction')",
        '    const importBare = bareImportFromHome(home)',
        "    expect(((await importBare('current')) as { mark: string }).mark).toBe('v1')",
        '',
        '    fs.rmSync(link, { force: true })',
        "    expect(fs.existsSync(path.join(home, '.pnpm', 'current@1.0.0', 'node_modules', 'current'))).toBe(true) // 删 junction 不伤目标",
        "    fs.symlinkSync(path.join(home, '.pnpm', 'current@2.0.0', 'node_modules', 'current'), link, 'junction')",
        "    expect(((await importBare('current')) as { mark: string }).mark).toBe('v2')",
      ],
      highlight: [69, 72],
    },
  },
];
