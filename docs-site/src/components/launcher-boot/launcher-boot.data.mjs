/**
 * 「从双击 gwb-kernel 到内核接手」的讲解数据：画面（launcher-boot.tsx）与机读版规则（launcher-boot.ai.mjs）都只读这一份。
 * 例子贯穿全页：不设 GWB_HOME 打开 default，安装包带 Electron 44.1.1，home 里装的是内核包 0.10.0。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、此刻环境变量 GWB_HOME 是什么、对应哪段源码。源码片段正上方的记号把它钉在源码上。
 */

/* ref file="../apps/launcher/package.json" lines="21-21" hash="f93a571f104b" blob="3837fd0122c5" */
/**
 * 参与者：启动器的两个文件是蓝色与紫色，home 里的内核包是灰色（包外的东西），Electron 也是灰色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/docfirst-explainer').Role }[]}
 */
export const actors = [
  { id: 'exe', name: 'gwb-kernel.exe', sub: 'Electron 44.1.1', role: 'slate' },
  { id: 'main', name: '启动器入口', sub: 'main.ts', role: 'blue' },
  { id: 'plan', name: '检查', sub: 'launch-plan.ts', role: 'violet' },
  { id: 'kernelHome', name: '内核选 home', sub: 'home-path.ts', role: 'slate' },
  { id: 'entry', name: '内核入口', sub: 'dist/main.js', role: 'slate' },
  { id: 'manifest', name: '内核包清单', sub: 'package.json', role: 'slate' },
];

/** 两个目录：上面是安装目录，下面是 default 这个 home */
export const bands = [
  { id: 'install', label: '安装目录 %LOCALAPPDATA%\\Programs\\gwb-kernel\\resources\\app.asar' },
  { id: 'home', label: 'home %APPDATA%\\gwb-kernel\\homes\\default\\node_modules\\@godcreator\\gwb-kernel-desktop' },
];

/** 例子里 default 的绝对路径 */
export const defaultHomeDir = 'C:\\Users\\you\\AppData\\Roaming\\gwb-kernel\\homes\\default';

/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], env: string, code: Code }} BootStep
 * @type {BootStep[]}
 */
export const steps = [
  /* ref file="../apps/launcher/src/main.ts" lines="14-15" hash="bd6bd7f09866" blob="f6547781d717" */
  {
    title: 'Electron 运行启动器',
    text:
      '开始菜单「gwb-kernel」运行安装目录里的 gwb-kernel.exe，它是 Electron，按 resources\\app.asar 里清单的 main 运行启动器的 main.js。' +
      '启动器先取当前 Electron 的版本，后面拿它和内核包声明的范围比；不在 Electron 里运行（比如被 node 直接运行）就抛错。',
    lit: ['exe', 'main'],
    shown: ['run'],
    env: '（未设）',
    code: {
      file: 'apps/launcher/src/main.ts',
      start: 14,
      lines: [
        'const electronVersion = process.versions.electron',
        "if (electronVersion === undefined) throw new Error('启动器只能在 Electron 里运行')",
      ],
    },
  },
  /* ref file="../apps/launcher/src/main.ts" lines="17-19" hash="475fe289ea98" blob="f6547781d717" */
  {
    title: '选定 home，写回绝对路径',
    text:
      'GWB_HOME 没设，按 default 算：不带路径分隔符的值是 appData 下 gwb-kernel\\homes\\<名字>。算出的绝对路径当场写回 GWB_HOME，' +
      '之后在这个进程里运行的内核读到的就是这个绝对路径。',
    lit: ['main', 'plan'],
    shown: ['homePathFor'],
    env: defaultHomeDir,
    code: {
      file: 'apps/launcher/src/main.ts',
      start: 17,
      lines: [
        "const homeDir = homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData'))",
        '// 内核启动时按同一条规则再选一次 home；给它绝对路径，两边一定是同一个目录',
        'process.env.GWB_HOME = homeDir',
      ],
      highlight: [17, 17],
    },
  },
  /* ref file="../apps/launcher/src/launch-plan.ts" lines="29-36" hash="12948c48a64e" blob="7dff040f70bd" */
  {
    title: '找到并读出内核包的清单',
    text:
      '检查只看 home 里 node_modules\\@godcreator\\gwb-kernel-desktop\\package.json 这一个文件：不在就是这个 home 还没装内核包，读不出或不是合法 JSON 也拒绝。' +
      '启动器不扫目录、不找别的版本，也不替人安装。',
    lit: ['plan', 'manifest'],
    shown: ['kernelEntryFor', 'read'],
    env: defaultHomeDir,
    code: {
      file: 'apps/launcher/src/launch-plan.ts',
      start: 29,
      lines: [
        'export function kernelEntryFor(homeDir: string, electronVersion: string): KernelEntry {',
        "  const packageDir = path.join(homeDir, 'node_modules', ...KERNEL_PACKAGE.split('/'))",
        "  const manifestFile = path.join(packageDir, 'package.json')",
        '  if (!fs.existsSync(manifestFile)) {',
        '    return { ok: false, message: `home ${homeDir} 里没有内核包 ${KERNEL_PACKAGE}：照内核仓的 INSTALL.md 把它装进这个 home` }',
        '  }',
        '  const manifest = readKernelManifest(manifestFile)',
        "  if (typeof manifest === 'string') return { ok: false, message: manifest }",
      ],
      highlight: [30, 32],
    },
  },
  /* ref file="../apps/launcher/src/launch-plan.ts" lines="38-52" hash="326602de0f8a" blob="7dff040f70bd" */
  /* ref file="../apps/desktop/package.json" lines="3-3" hash="8a14e97c8586" blob="fab53490ba27" */
  /* ref file="../apps/desktop/package.json" lines="8-8" hash="3f8ef1581707" blob="df73ceac0ed7" */
  /* ref file="../apps/desktop/package.json" lines="34-36" hash="d14faf1367c1" blob="df73ceac0ed7" */
  {
    title: '比 Electron 版本，找入口',
    text:
      '内核包 0.10.1 的清单写着 engines.electron 是 ^44.1.1，安装包带的 44.1.1 在范围里；main 是 dist/main.js，入口就是内核包目录下的这个文件。' +
      '没声明范围、版本不满足、没有 main，各回一句说明原因的话。',
    lit: ['plan', 'manifest'],
    shown: ['kernelEntryFor', 'read'],
    env: defaultHomeDir,
    code: {
      file: 'apps/launcher/src/launch-plan.ts',
      start: 38,
      lines: [
        '  const kernelVersion = String(manifest.version)',
        '  const electronRange = manifest.engines?.electron',
        "  if (typeof electronRange !== 'string') {",
        '    return { ok: false, message: `内核包 ${kernelVersion} 没有声明 engines.electron，确认不了它能不能在 Electron ${electronVersion} 上运行` }',
        '  }',
        '  if (!semver.satisfies(electronVersion, electronRange)) {',
        '    return {',
        '      ok: false,',
        '      message: `内核包 ${kernelVersion} 要求 Electron ${electronRange}，这个安装包带的是 ${electronVersion}：装新版安装包，或在 home ${homeDir} 里装一个支持它的内核`,',
        '    }',
        '  }',
        "  if (typeof manifest.main !== 'string') {",
        '    return { ok: false, message: `内核包 ${kernelVersion} 的清单 ${manifestFile} 没有 main 入口` }',
        '  }',
        '  return { ok: true, entryFile: path.join(packageDir, manifest.main) }',
      ],
      highlight: [43, 43],
    },
  },
  /* ref file="../apps/launcher/src/main.ts" lines="21-29" hash="597eb062da8b" blob="f6547781d717" */
  {
    title: 'import 内核入口，不等它',
    text:
      '检查通过，启动器用一次动态 import 把内核入口交给 Node 加载，然后自己的模块就求值完了。这里不能 await：Electron 要等入口模块求值完才触发 ready，' +
      '内核在自己求值时只把启动注册到 app.whenReady() 上。import 抛错（比如 home 里缺 cordis）就弹框、退出码 1，调用栈原样带上。',
    lit: ['main', 'entry'],
    shown: ['import'],
    env: defaultHomeDir,
    code: {
      file: 'apps/launcher/src/main.ts',
      start: 21,
      lines: [
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
      highlight: [24, 26],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="51-51" hash="c3ca29673cbe" blob="db3e92ccd653" */
  {
    title: '内核按同一条规则再选一次 home',
    text:
      '内核不知道自己是被启动器加载的，还是从仓里 pnpm start 直接运行的，两种情况都自己读 GWB_HOME。它读到的是启动器写回的绝对路径，带路径分隔符，' +
      '按规则就是这个目录本身，所以一定和启动器检查的是同一个 home。之后建目录、检查 package.json 与 cordis.yml、加单实例锁、写日志，都是内核的事。',
    lit: ['entry', 'kernelHome'],
    shown: ['rehome'],
    env: defaultHomeDir,
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 50,
      lines: ["const homePath = homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData'))"],
    },
  },
];
