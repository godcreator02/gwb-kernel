/**
 * 「启动器遇到的几种 home」的讲解数据：画面（launcher-cases.tsx）与机读版规则（launcher-cases.ai.mjs）都只读这一份。
 * 每种情况：home 里内核包的清单长什么样、按顺序的几道检查走到哪一道停下、结果是内核接手还是弹框。
 * 例子里的 home 是 default，安装包带 Electron 44.1.1。弹框的原因照抄 apps/launcher/src/launch-plan.ts 与 main.ts，
 * 只把 ${…} 换成例子里的值，正上方的记号把它钉在源码上。
 */

export const homeDir = 'C:\\Users\\you\\AppData\\Roaming\\gwb-kernel\\homes\\default';
export const manifestFile = `${homeDir}\\node_modules\\@godcreator\\gwb-kernel-desktop\\package.json`;

/* ref file="../apps/launcher/src/launch-plan.ts" lines="29-53" hash="79a3468b5e17" blob="7dff040f70bd" */
/* ref file="../apps/launcher/package.json" lines="21-21" hash="f93a571f104b" blob="3837fd0122c5" */
/** 按顺序的检查：前五道在 kernelEntryFor 里，最后一道是 main.ts 的动态 import */
export const checks = [
  { id: 'exists', text: 'home 里有内核包的清单 node_modules\\@godcreator\\gwb-kernel-desktop\\package.json' },
  { id: 'json', text: '清单读得出，是合法 JSON' },
  { id: 'engines', text: '清单声明了 engines.electron' },
  { id: 'satisfies', text: '安装包带的 Electron 44.1.1 在这个范围里' },
  { id: 'main', text: '清单里有 main' },
  { id: 'import', text: 'import 入口文件没有抛错' },
];

/* ref file="../apps/launcher/src/launch-plan.ts" lines="20-26" hash="2962b220b3fd" blob="7dff040f70bd" */
/* ref file="../apps/launcher/src/main.ts" lines="7-12" hash="3f735c49f055" blob="f6547781d717" */
/* ref file="../apps/launcher/src/main.ts" lines="24-26" hash="24e21848e8c2" blob="f6547781d717" */
/* ref file="../apps/desktop/package.json" lines="3-3" hash="8a14e97c8586" blob="fab53490ba27" */
/* ref file="../apps/desktop/package.json" lines="8-8" hash="3f8ef1581707" blob="df73ceac0ed7" */
/* ref file="../apps/desktop/package.json" lines="34-39" hash="3daa60be1e2f" blob="df73ceac0ed7" */
/**
 * @typedef {{ id: string, label: string, text: string, manifest: string[] | null, stopAt: string | null, message: string | null }} LauncherCase
 * @type {LauncherCase[]}
 */
export const cases = [
  {
    id: 'ok',
    label: '装好了',
    text:
      '照 INSTALL.md 装好的 default：清单里 engines.electron 是 ^44.1.1、main 是 dist/main.js。清单的几道检查都过，启动器 import 内核入口、没有抛错，窗口、插件、日志从这里起都由内核负责。',
    manifest: ['{', '  "name": "@godcreator/gwb-kernel-desktop",', '  "version": "0.10.1",', '  "main": "dist/main.js",', '  "engines": { "electron": "^44.1.1" },', '  …', '}'],
    stopAt: null,
    message: null,
  },
  {
    id: 'no-kernel',
    label: '刚装完安装包',
    text:
      '安装程序只放下 Electron 与启动器，home 里还没有内核包（或者装在了别的 home）。这是第一次安装后直接启动一定会看到的弹框：点确定后退出码 1，home 里不写任何文件。照 INSTALL.md 往这个 home 装内核包、cordis 与插件再启动。',
    manifest: null,
    stopAt: 'exists',
    message: `home ${homeDir} 里没有内核包 @godcreator/gwb-kernel-desktop：照内核仓的 INSTALL.md 把它装进这个 home`,
  },
  {
    id: 'bad-json',
    label: '清单读不了',
    text: '清单文件在，但读不出来或不是合法 JSON（比如装到一半被打断）。原因里带上清单的完整路径和读取时报的错。',
    manifest: ['{ not json'],
    stopAt: 'json',
    message: `读不了内核包的清单 ${manifestFile}：<JSON.parse 或读文件报的错>`,
  },
  {
    id: 'no-engines',
    label: '没声明 Electron 范围',
    text: '清单里没有 engines.electron，启动器确认不了这个内核能不能在自带的 Electron 上运行，不猜、直接拒绝。',
    manifest: ['{', '  "version": "0.3.0",', '  "main": "dist/main.js"', '}'],
    stopAt: 'engines',
    message: '内核包 0.3.0 没有声明 engines.electron，确认不了它能不能在 Electron 44.1.1 上运行',
  },
  {
    id: 'mismatch',
    label: 'Electron 太旧',
    text:
      '假设这个 home 里的内核升到了一个换了 Electron 主版本的版本，要 ^45.0.0，而机器上的安装包还带 44.1.1。要么装新版安装包，要么在这个 home 里装回支持 44 的内核。',
    manifest: ['{', '  "version": "1.0.0",', '  "main": "dist/main.js",', '  "engines": { "electron": "^45.0.0" }', '}'],
    stopAt: 'satisfies',
    message: `内核包 1.0.0 要求 Electron ^45.0.0，这个安装包带的是 44.1.1：装新版安装包，或在 home ${homeDir} 里装一个支持它的内核`,
  },
  {
    id: 'no-main',
    label: '没有入口',
    text: '范围对得上，但清单里没有 main，不知道 import 哪个文件。',
    manifest: ['{', '  "version": "0.3.0",', '  "engines": { "electron": "^44.1.0" }', '}'],
    stopAt: 'main',
    message: `内核包 0.3.0 的清单 ${manifestFile} 没有 main 入口`,
  },
  {
    id: 'import-throws',
    label: '入口 import 失败',
    text:
      '清单全对，但 import 内核入口时抛错，比如 home 根上没装 cordis：内核把 cordis 写成 peer，按 home 解析找不到它。启动器把错误的调用栈原样放进弹框，同样退出码 1。',
    manifest: ['{', '  "version": "0.10.1",', '  "main": "dist/main.js",', '  "engines": { "electron": "^44.1.1" },', '  "peerDependencies": { "cordis": "4.0.0-rc.10" }', '}'],
    stopAt: 'import',
    message: '内核启动失败：<import 抛的错误与调用栈>',
  },
];
