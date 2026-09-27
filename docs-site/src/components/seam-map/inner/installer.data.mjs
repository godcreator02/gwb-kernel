/**
 * 安装包的内部接缝图：安装包首页 <SeamMap module="installer" /> 画的就是它。
 * 上半张是运行时：安装版 Electron 运行启动器（apps/launcher/src/ 下两个文件），启动器从 home 里加载内核包；
 * 下半张是打包：installer/scripts/build.ps1 读启动器的清单、组装应用目录、调 electron-builder 打出安装程序。
 * 虚线框是启动器与打包脚本里的文件，灰色实线框是包外的东西。坐标在 installer.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/explainer-player/seam-graph';

export const installerGraph = defineSeamGraph({
  id: 'installer',
  title: '安装包内部的文件与接缝',
  intro:
    '安装包内部接缝图：上半张是运行时，安装版 Electron 运行启动器的 main.ts，启动器选定 home、检查 home 里的内核包、把内核入口 import 进来；' +
    '下半张是打包，build.ps1 读启动器的清单、组装应用目录 build/app，再调 electron-builder 打出 NSIS 安装程序。' +
    '虚线框是 apps/launcher 与 installer/ 里的文件，框里的方块是它们对外给的函数或字段，灰色实线框是包外的东西。' +
    '启动器与内核包之间没有代码接口，只靠环境变量 GWB_HOME 与内核包清单里的 engines.electron、main 两个字段。',
  frameLabel: '文件',
  modules: [
    {
      id: 'electron',
      name: 'Electron',
      pkg: '安装包里的运行时',
      role: null,
      outside: true,
      blurb:
        '安装程序把 Electron 与启动器装到 %LOCALAPPDATA%\\Programs\\gwb-kernel\\。gwb-kernel.exe 运行 resources\\app.asar 里清单 main 指向的 main.js。' +
        '版本只写在 apps/launcher/package.json 的 devDependencies.electron。',
      caps: [
        { id: 'electron-api', name: '版本与弹框', ident: 'versions.electron · dialog' },
        { id: 'exe', name: '启动', ident: 'gwb-kernel.exe → main.js' },
      ],
    },
    {
      id: 'kernel',
      name: 'home 里的内核包',
      pkg: '@godcreator/gwb-kernel-desktop',
      role: null,
      outside: true,
      blurb:
        '内核是 npm 包，和插件一样装在每个 home 的 node_modules 里，由创建 home 的一方安装（default 照仓根 INSTALL.md，测试 home 由 devkit.home.new）。' +
        '启动器只读它的清单、import 清单 main 指向的入口；内核启动时按同一条规则再读一次 GWB_HOME。',
      caps: [
        { id: 'kernel-entry', name: '内核入口', ident: 'dist/main.js' },
        { id: 'kernel-home', name: '内核选 home', ident: 'home-path.ts' },
        { id: 'manifest', name: '清单', ident: 'engines.electron · main' },
      ],
    },
    {
      id: 'entry',
      name: '启动器入口',
      pkg: 'apps/launcher/src/main.ts',
      role: 'blue',
      outside: false,
      blurb:
        '安装版 Electron 运行的第一个模块。按 GWB_HOME 选定 home、把绝对路径写回 GWB_HOME，问 launch-plan 这个 home 里的内核包能不能在当前 Electron 上启动；' +
        '能就 import 内核入口，不能或 import 抛错就弹框、退出码 1。不写 home，不替人安装。',
      caps: [
        { id: 'fail', name: '拒绝', ident: 'fail(message)' },
        { id: 'load', name: '加载内核', ident: 'import(entryFile)' },
        { id: 'select', name: '选定 home', ident: 'GWB_HOME → homeDir' },
      ],
    },
    {
      id: 'plan',
      name: '检查',
      pkg: 'apps/launcher/src/launch-plan.ts',
      role: 'violet',
      outside: false,
      blurb:
        '两个纯函数，只读文件、不碰 Electron，全部有单测：homePathFor 把 GWB_HOME 的值算成 home 目录；kernelEntryFor 读 home 里内核包的清单，' +
        '依次检查清单在不在、读不读得出、有没有 engines.electron、当前 Electron 在不在范围里、有没有 main，给出入口文件或一句拒绝原因。',
      caps: [
        { id: 'home-rule', name: '选 home 的规则', ident: 'homePathFor' },
        { id: 'entry-check', name: '检查内核包', ident: 'kernelEntryFor' },
      ],
    },
    {
      id: 'build',
      name: '打包脚本',
      pkg: 'installer/scripts/build.ps1',
      role: 'amber',
      outside: false,
      blurb:
        '在仓根运行 pwsh installer\\scripts\\build.ps1。内核仓里已跟踪的文件有未提交的改动就停下（git status --porcelain，未跟踪的不算）；' +
        '构建启动器、组装 installer\\build\\app、调 electron-builder。每条 npm / pnpm 之后都检查退出码，任何一步失败都不往下走。',
      caps: [
        { id: 'clean-check', name: '检查工作区', ident: 'git status --porcelain' },
        { id: 'assemble', name: '组装应用目录', ident: 'build/app' },
        { id: 'run-builder', name: '打包', ident: '--config.electronVersion' },
      ],
    },
    {
      id: 'launcher-pkg',
      name: '启动器清单',
      pkg: 'apps/launcher/package.json',
      role: 'cyan',
      outside: false,
      blurb:
        '启动器 gwb-kernel-launcher 的清单，不发布。安装包的版本号就是它的 version；Electron 的版本只写在它的 devDependencies.electron 这一处；' +
        '运行时依赖只有 semver，打包时照抄进应用目录的清单。',
      caps: [
        { id: 'launcher-build', name: '构建', ident: 'pnpm build → dist/' },
        { id: 'launcher-version', name: '安装包版本', ident: 'version' },
        { id: 'electron-pin', name: 'Electron 版本', ident: 'devDependencies.electron' },
      ],
    },
    {
      id: 'output',
      name: '安装产物',
      pkg: 'installer/build/dist/',
      role: null,
      outside: true,
      blurb:
        'gwb-setup-<版>.exe 是 NSIS 安装程序：一键安装、按当前用户安装、不需要管理员权限，发到 gitea 发布页。win-unpacked/ 是打包前的目录，只用来验证；' +
        '每次打包整个重新生成，日常别直接运行它。',
      caps: [
        { id: 'setup', name: '安装程序', ident: 'gwb-setup-<版>.exe' },
        { id: 'unpacked', name: '打包前目录', ident: 'win-unpacked/' },
      ],
    },
    {
      id: 'eb',
      name: 'electron-builder',
      pkg: 'installer/node_modules',
      role: null,
      outside: true,
      blurb:
        'installer/package.json 的开发依赖，installer/ 不在 pnpm 工作区里，没装时脚本先 npm install。它的工具二进制经环境变量 ELECTRON_BUILDER_BINARIES_MIRROR 从国内镜像下载。',
      caps: [{ id: 'eb-cli', name: '打出安装程序', ident: 'electron-builder --win' }],
    },
    {
      id: 'builder-config',
      name: '打包配置',
      pkg: 'installer/electron-builder.yml',
      role: 'emerald',
      outside: false,
      blurb:
        '应用目录 build/app、产物目录 build/dist、收哪些文件、NSIS 选项、Electron 二进制的下载镜像。不写 electronVersion：版本由 build.ps1 从启动器清单读出后经命令行传入。',
      caps: [
        { id: 'nsis', name: '安装程序形态', ident: 'nsis · artifactName' },
        { id: 'mirror', name: 'Electron 下载源', ident: 'electronDownload.mirror' },
      ],
    },
  ],
  entries: [
    { id: 'user', name: '人 · agent', to: 'exe' },
    { id: 'dev', name: '改内核的人 · 打安装包', to: 'clean-check' },
  ],
  seams: [
    {
      n: 1,
      name: '启动',
      a: ['exe'],
      b: ['select'],
      iface: 'Electron 运行 resources\\app.asar 里清单 main 指向的 main.js',
      convention: false,
      via: 'code',
      text:
        '开始菜单「gwb-kernel」运行的就是这个 exe。应用目录的清单由打包脚本写成 main: main.js，启动器的全部代码与 semver 都在 app.asar 里；安装程序只在安装时用一次。',
    },
    /* ref file="../apps/launcher/src/main.ts" lines="17-19" hash="475fe289ea98" blob="f6547781d717" */
    {
      n: 2,
      name: '选定 home',
      a: ['select'],
      b: ['home-rule'],
      iface: "homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData')) → 绝对路径",
      convention: false,
      via: 'code',
      text:
        'GWB_HOME 不设是 default；只写名字是 appData 下的 gwb-kernel\\homes\\<名字>；带路径分隔符就是那个目录本身，相对路径按当前目录解析。算出的绝对路径当场写回 GWB_HOME。',
    },
    /* ref file="../apps/launcher/src/launch-plan.ts" lines="7-10" hash="88a97c55a6cf" blob="7dff040f70bd" */
    /* ref file="../apps/desktop/src/home-path.ts" hash="482874f47488" blob="8f1ac8757a53" */
    {
      n: 3,
      name: '选 home 的规则写两份',
      a: ['home-rule'],
      b: ['kernel-home'],
      iface: '/[\\\\/]/.test(值) ? path.resolve(值) : path.join(appData, "gwb-kernel", "homes", 值)',
      convention: true,
      via: 'code',
      text:
        '启动器要先知道 home 在哪才找得到内核，没法 import 内核那一份，所以同一条规则写了两份。启动器的测试拿同一组输入逐个比对两份的结果；改规则时两份一起改，否则启动器检查的 home 和内核打开的 home 不是同一个。',
    },
    /* ref file="../apps/launcher/src/launch-plan.ts" lines="12-12" hash="0df3164567db" blob="7dff040f70bd" */
    {
      n: 4,
      name: '检查内核包',
      a: ['load'],
      b: ['entry-check'],
      iface: 'kernelEntryFor(homeDir, process.versions.electron) → { ok: true, entryFile } | { ok: false, message }',
      convention: false,
      via: 'code',
      text:
        '启动器入口只看回的是哪一种：ok 就拿 entryFile 去 import，不 ok 就把 message 原样交给 fail。拒绝原因全部在 launch-plan 里写成一句给人看的话：是哪个 home、缺什么、怎么补。',
    },
    /* ref file="../apps/launcher/src/launch-plan.ts" lines="29-53" hash="79a3468b5e17" blob="7dff040f70bd" */
    {
      n: 5,
      name: '内核包清单',
      a: ['entry-check'],
      b: ['manifest'],
      iface: '<home>/node_modules/@godcreator/gwb-kernel-desktop/package.json 的 version · engines.electron · main',
      convention: true,
      via: 'disk',
      text:
        '只读这一个文件。engines.electron 是内核声明的 Electron 版本范围，用 semver.satisfies 拿当前 Electron 比；main 是入口文件，相对内核包目录。version 只用在拒绝原因里。清单缺字段或格式不对都拒绝，不猜缺省值。',
    },
    /* ref file="../apps/launcher/src/main.ts" lines="21-29" hash="597eb062da8b" blob="f6547781d717" */
    {
      n: 6,
      name: '交给内核',
      a: ['select', 'load'],
      b: ['kernel-entry'],
      iface: 'process.env.GWB_HOME = homeDir；import(pathToFileURL(entryFile).href)',
      convention: true,
      via: 'code',
      text:
        '启动器与内核之间只有这两样：环境变量里的绝对路径，和一次动态 import。import 不 await：启动器的模块求值完 Electron 才触发 ready，内核在自己求值时把启动注册到 app.whenReady() 上。内核按同一条规则再读 GWB_HOME，读到的是绝对路径，打开的一定是启动器检查过的那个目录。',
    },
    /* ref file="../apps/launcher/src/main.ts" lines="7-12" hash="3f735c49f055" blob="f6547781d717" */
    {
      n: 7,
      name: '拒绝',
      a: ['fail'],
      b: ['electron-api'],
      iface: "stderr 一行 gwb-launcher: <原因>；dialog.showErrorBox('gwb 启动失败', 原因)；app.exit(1)",
      convention: false,
      via: 'code',
      text:
        'launch-plan 拒绝、或内核入口 import 抛错（错误的调用栈原样带上）都走这里。拒绝时 home 里不写任何文件：内核还没运行，没有 gwb.log，原因只在弹框与 stderr 里。',
    },
    /* ref file="../apps/launcher/tests/launch-plan.test.ts" lines="96-104" hash="c785998cdb98" blob="196cbe33b166" */
    {
      n: 8,
      name: 'Electron 版本对得上',
      a: ['electron-pin'],
      b: ['manifest'],
      iface: 'semver.satisfies(启动器 devDependencies.electron, 内核包 engines.electron)',
      convention: true,
      via: 'disk',
      text:
        '启动器带哪个 Electron 写在启动器清单，内核要哪个范围写在内核包清单，两边没有代码引用。启动器的测试读两份清单比对，本仓的内核与启动器对不上时 pnpm check 失败；已经发出去的安装包与 home 里别的内核版本，只能靠运行时的检查（接缝 5）拒绝。',
    },
    /* ref file="../installer/scripts/build.ps1" lines="24-48" hash="5f599be4c4c1" blob="d883fc0fa1c8" */
    {
      n: 9,
      name: '读启动器清单',
      a: ['assemble', 'run-builder'],
      b: ['launcher-build', 'launcher-version', 'electron-pin'],
      iface: 'pnpm build → 复制 dist/*.js；清单的 productName · version · description · author · dependencies 写进 build/app/package.json',
      convention: false,
      via: 'disk',
      text:
        '应用目录的清单只留运行要的字段，入口写 main.js、依赖照抄，再 npm install。依赖必须写进清单：electron-builder 按清单收集 node_modules，--no-save 装的包它不收。electron 的版本在这里读出来，留给下一步传给 electron-builder。',
    },
    /* ref file="../installer/scripts/build.ps1" lines="50-58" hash="509d2766e4e7" blob="d883fc0fa1c8" */
    {
      n: 10,
      name: '调 electron-builder',
      a: ['run-builder'],
      b: ['eb-cli'],
      iface: 'npx electron-builder --win --config.electronVersion=<devDependencies.electron>',
      convention: false,
      via: 'code',
      text:
        'electron-builder 只在项目根找 electron 的版本、不看应用目录，而 installer/ 自己不依赖 electron，所以版本经命令行传入。退出码不是 0 就停下。',
    },
    /* ref file="../installer/electron-builder.yml" lines="5-23" hash="ac20fbaf5030" blob="f2c1ac8ae6c9" */
    {
      n: 11,
      name: '打包配置',
      a: ['eb-cli'],
      b: ['nsis', 'mirror'],
      iface: 'directories.app build/app → output build/dist；files；nsis.oneClick · perMachine: false · artifactName；electronDownload.mirror',
      convention: false,
      via: 'disk',
      text:
        'productName gwb-kernel 决定安装目录名与开始菜单项；perMachine: false 是按当前用户安装、不需要管理员权限；artifactName 里的 ${version} 就是应用目录清单的 version，也就是启动器的版本。',
    },
    {
      n: 12,
      name: '安装程序',
      a: ['eb-cli'],
      b: ['setup', 'unpacked'],
      iface: 'installer/build/dist/gwb-setup-<版>.exe · installer/build/dist/win-unpacked/',
      convention: false,
      via: 'disk',
      text:
        '打完脚本列出产物的文件名与大小。build/ 整个在 installer/.gitignore 里，每次打包重新生成；win-unpacked/ 用来在临时 home 上验证打包形态能启动。',
    },
    {
      n: 13,
      name: '安装',
      a: ['setup'],
      b: ['exe'],
      iface: "Start-Process .\\gwb-setup-<版>.exe -ArgumentList '/S' -Wait → %LOCALAPPDATA%\\Programs\\gwb-kernel\\",
      convention: false,
      via: 'disk',
      text:
        '静默安装只放下 Electron 与启动器、建开始菜单项，不建 home、不装内核与插件。装完第一次启动时 home 里还没有内核包，启动器按接缝 7 拒绝，照仓根 INSTALL.md 把内核包、cordis 与插件装进 home 后再启动。',
    },
  ],
});
