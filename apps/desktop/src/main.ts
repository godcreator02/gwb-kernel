import electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context, type Fiber } from 'cordis'
import Loader, { type ModuleLoader } from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import type { GwbCommands, GwbKernelApi } from '@godcreator/gwb-plugin-api'
import { collectImports } from './imports.js'
import { bareImportFromHome } from './bare-import.js'
import { describeEntry, type EntryStatus } from './entry-state.js'
import { limitFromEnv, openLogFile } from './log-file.js'

/**
 * gwb 内核的主进程入口：cordis 实例和所有插件都在这个进程里，页面是唯一的另一个进程；不依赖
 * electron 的纯函数放在旁边几个模块（imports / bare-import / entry-state / log-file），各自有单元测试。
 * 只做第一个插件运行之前必须完成的事：准备 home、创建 cordis 实例、加载插件、创建窗口、转交命令、
 * 推送事件、告诉页面外壳是谁、自己出错时让人看得见。其余都由插件实现。取舍见文档站
 */

const { app, BrowserWindow, Menu, dialog, ipcMain } = electron
const here = path.dirname(fileURLToPath(import.meta.url))
/** 内核自己的版本号：读本包的清单（dist/ 的上一级）。从仓里运行、从安装包运行读的都是这一份，不读应用外层的清单 */
const kernelVersion = (JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8')) as { version: string }).version

declare module 'cordis' {
  interface Context {
    /** 内核的服务，在根上下文上提供、永不撤销 */
    gwbKernel: GwbKernelApi
    /** 命令总线，由内置的命令插件提供；它加载失败时是 undefined */
    gwbCommands?: GwbCommands
  }
}

/** 用哪个 home：`GWB_HOME` 是个名字就用 appData/gwb-kernel/homes/<名>，带路径分隔符就当成目录本身 */
const homeArg = process.env.GWB_HOME ?? 'default'
const homePath = /[\\/]/.test(homeArg) ? path.resolve(homeArg) : path.join(app.getPath('appData'), 'gwb-kernel', 'homes', homeArg)
fs.mkdirSync(homePath, { recursive: true })
// realpath 把大小写、junction、斜杠写法都统一成磁盘上的真实路径：同一 home 的两种写法必须得到
// 同一个字符串，下面按 userData 生效的单实例锁才认得出「同一个 home」
const dataDir = fs.realpathSync.native(homePath)

/**
 * Chromium 的 userData 每个 home 一份（<home>/electron）：单实例锁按它区分，多个 home 同时运行时
 * Local Storage 互不影响。homes 的根从 appData 算、不从 userData 算——userData 已按 home 分开，从它算就递归了
 */
app.setPath('userData', path.join(dataDir, 'electron'))

/** home 能启动的最小形态：包清单、空条目表。缺哪样补哪样，不覆盖 */
for (const [file, content] of [
  ['package.json', '{\n  "name": "gwb-home",\n  "private": true\n}\n'],
  ['cordis.yml', '[]\n'],
] as const) {
  const target = path.join(dataDir, file)
  if (!fs.existsSync(target)) fs.writeFileSync(target, content)
}

/**
 * 内核唯一的日志输出：stderr 加 home 里一份**带上限与轮转**的文件。一个插件都没有时人也看得见。
 *
 * 上限的依据：这份日志用来事后查错，不是存档——排查问题要看的是「最近一次启动到现在」那一段，
 * 再往前的没人看。实测 2026-09-20 那份 6.67 GB：平时约 2 MB/h（约 48 MB/日），遇到大量输出日志的插件能到
 * 约 675 MB/h（约 16 GB/日）——那 6.67 GB 里有 5.8 GB 是一夜之间写出来的。取 128 MB：平时能留
 * 两天半，大量输出时十几分钟轮转一次，磁盘总占用（当前的加一份旧的）在 256 MB 以内。
 */
const log = openLogFile({
  file: path.join(dataDir, 'gwb.log'),
  // 单位 MB，由 `GWB_LOG_LIMIT_MB` 设置；0 = 不轮转（排查问题时要留全部日志）。放在环境变量上、不做成
  // 设置项：改它是排查问题时的一次性操作，而加一个设置项要改设置插件的契约
  limitBytes: limitFromEnv(process.env.GWB_LOG_LIMIT_MB),
  keep: 1,
  // 轮转或打开文件出错时写一句。**不走 say**：say 也往这个文件写，会自己等自己
  onWarn: (msg) => {
    process.stderr.write(`${new Date().toISOString()} warn kernel ${msg}\n`)
  },
})
function say(level: string, name: string, msg: string): void {
  const line = `${new Date().toISOString()} ${level} ${name} ${msg}\n`
  process.stderr.write(line)
  log.write(line)
}
const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))
// 没有终端时（stderr 的另一端断开）每写一次都抛 EPIPE，忽略它，日志文件照常写
process.stderr.on('error', () => {})

/**
 * 同一 home 只允许一个实例：用 Electron 的单实例锁，按上面每个 home 一份的 userData 区分。第二个实例
 * 拿不到锁就报一句、退出码 1、不动 runtime.json；正在运行的那个收到 second-instance 把窗口调到前面。
 * 不自己写锁文件（理由见文档站）
 */
if (!app.requestSingleInstanceLock()) {
  say('error', 'kernel', `home ${dataDir} 已有实例在运行，本实例退出`)
  app.exit(1)
}

/**
 * 这次运行的信息写进 `runtime.json`：pid、启动时刻、版本、应用目录，外加 Chromium 调试端口
 * ——只有启动进程的一方知道这个端口，页面读不到。**每次启动整份重写**（与上面两个文件
 * 「缺什么补什么」相反：那两个属于 home，这一份描述的是当前这个进程）；退出时不删，读的一方
 * 负责确认进程还在；写入失败只报一句。理由见文档站
 */
const cdpPort = Number(app.commandLine.getSwitchValue('remote-debugging-port'))
try {
  fs.writeFileSync(
    path.join(dataDir, 'runtime.json'),
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: Date.now(),
        version: kernelVersion,
        appDir: app.getAppPath(),
        // 没开调试端口就没有这个字段：写 0 或 null 的话，读的一方还得再判断一次这个值有没有意义
        ...(Number.isInteger(cdpPort) && cdpPort > 0 && cdpPort < 65536 ? { cdp: cdpPort } : {}),
      },
      null,
      2,
    ) + '\n',
  )
} catch (err) {
  say('warn', 'kernel', `runtime.json 写入失败：${stackOf(err)}`)
}

const ctx = new Context()
/** 模块解析的起点指向 home；loader 与 include 都从根上下文继承它 */
ctx.baseUrl = pathToFileURL(dataDir + path.sep).href
/** loader 的 fiber，退出时（will-quit）卸载它，连带卸载整棵插件树；main() 加载 loader 之前是 undefined */
let loaderFiber: Fiber | undefined

// cordis 的日志全部交给 say。格式化用 cordis 自己的 Logger.format（能处理 %s、%o、Error），
// 类从一个实例的 constructor 上取，免得 import cordis 的内部模块。buffer 是 cordis 自带的环形缓冲，
// 只读状态页的错误行从这里筛
interface LogMessage {
  ts?: number
  type?: string
  name?: string
  args?: unknown[]
}
const factory = ctx.logger as unknown as {
  (name: string): { constructor: { format(exporter: unknown, message: unknown): string } }
  exporter(exporter: unknown): void
  buffer?: LogMessage[]
}
const Logger = factory('gwb').constructor
function formatMessage(message: LogMessage): string {
  try {
    return Logger.format(exporter, message)
  } catch {
    return (message.args ?? []).map((a) => (a instanceof Error ? a.message : String(a))).join(' ')
  }
}
const exporter = {
  colors: 0,
  levels: { default: 3 },
  // 级别与名字在 cordis 那边就是字符串，正文才是任意值
  export: (message: LogMessage): void => {
    say(message.type ?? 'info', message.name ?? '', formatMessage(message))
    // 错误行是只读状态页的一部分，来一条就重新推送一次（去抖）
    if (message.type === 'error' || message.type === 'warn') pushShell()
  },
}
factory.exporter(exporter)

/**
 * 内核自己的日志也走 cordis logger，不直接 say：任何插件注册一个 exporter 就能收到内核、插件、页面
 * 三个来源的日志，内核不为窗格另建通道。say 只给 exporter 本身和启动失败那一句用。见文档站
 */
const kernelLog = ctx.logger('kernel')
// 插件运行在这个进程里，插件的错误就是这个进程的错误。只记录不退出：一个坏插件不该让整个工作台退出
process.on('unhandledRejection', (e) => kernelLog.error(`没有被处理的 rejection（插件加载失败多半在这里）：${stackOf(e)}`))
process.on('uncaughtException', (e) => kernelLog.error(`未捕获异常：${stackOf(e)}`))

/**
 * 只读状态页的数据：各条目加载到哪一步、最近的错误行。只在没有外壳时显示，数据都是内核手上已有的
 * （loader 的条目树、logger 的缓冲），不分析原因、不放按钮。理由见文档站
 */
interface Report {
  home: string
  entries: EntryStatus[]
  errors: string[]
}
function report(): Report {
  // 页面第一次请求可能早于 loader 加载，那时服务还不在
  const loader = ctx.loader as typeof ctx.loader | undefined
  const entries = loader === undefined ? [] : [...loader.entries()]
  const errors = (factory.buffer ?? [])
    .filter((m) => m.type === 'error' || m.type === 'warn')
    .slice(-20)
    .map((m) => `${new Date(m.ts ?? Date.now()).toISOString()} ${m.type ?? ''} ${m.name ?? ''} ${formatMessage(m)}`)
  return {
    home: dataDir,
    entries: entries.map((e) => ({ id: e.id, name: e.options.name, state: describeEntry(e) })),
    errors,
  }
}

let win: electron.BrowserWindow | null = null
// 第二个实例拿不到锁时 Electron 会通知第一个实例：把已打开的窗口调到前面，第二次双击看到的是原窗口
app.on('second-instance', () => {
  if (win === null) return
  win.show()
  win.focus()
})
/** 页面根交给谁。插件经 setShell 设置，页面经 onShell 订阅 */
let shellUrl: string | null = null
/** 推给页面的内容：外壳地址、importmap、只读状态页的数据。每次重新计算：共享包装了或升级了，整页重载时页面再请求一次就拿到新的 importmap */
const shellMessage = (): { url: string | null; imports: Record<string, string>; report: Report } => ({
  url: shellUrl,
  imports: collectImports({ dataDir, warn: (msg) => kernelLog.warn(msg) }),
  report: report(),
})
// 条目状态变化、新的错误行都会触发重新推送，去抖成一次；页面上有外壳时不看 report
let pushTimer: NodeJS.Timeout | null = null
function pushShell(): void {
  if (pushTimer !== null) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    win?.webContents.send('gwb:shell', shellMessage())
  }, 200)
}
ctx.on('internal/status', () => pushShell())

const kernel: GwbKernelApi = {
  dataDir,
  version: kernelVersion,
  emit: (payload) => win?.webContents.send('gwb:event', payload),
  setShell: (url) => {
    shellUrl = url
    win?.webContents.send('gwb:shell', shellMessage())
    return () => {
      if (shellUrl !== url) return
      shellUrl = null
      win?.webContents.send('gwb:shell', shellMessage())
    }
  },
}
ctx.provide('gwbKernel', kernel)

/** 页面发来的命令一律交给 ctx.gwbCommands，内核不认识任何命令名 */
ipcMain.handle('gwb:command', (_event, command: unknown, args: unknown) => {
  if (typeof command !== 'string') return { ok: false, error: '命令名要是字符串' }
  const bus = ctx.gwbCommands
  if (bus === undefined) return { ok: false, error: `没有命令服务（ctx.gwbCommands），无法执行 ${command}` }
  return bus.run(command, args)
})
/** 页面订阅 onShell 时请求一次当前值 */
ipcMain.on('gwb:hello', (event) => event.sender.send('gwb:shell', shellMessage()))

async function main(): Promise<void> {
  // 应用没设菜单时 Electron 会给一套默认菜单（File/Edit/View/Window），没有用，设成 null。
  // 内核不替插件做菜单：需要菜单的插件自己调 setApplicationMenu（要在 ready 之后调用）
  Menu.setApplicationMenu(null)
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    // 窗口底色取设计令牌暗色主题的背景色（tokens.css 的 --background ≈ #151518），与 index.html 的
    // html 背景是同一个值：窗口创建到第一帧之间、最小化还原时、整页重载的第一帧，
    // 露出来的都是这个颜色而不是白色。默认主题换了底色时，这里和 index.html 一起改
    backgroundColor: '#151518',
    // 第一帧画好再显示窗口（ready-to-show），启动时也不闪白
    show: false,
    webPreferences: { preload: path.join(here, 'preload.cjs') },
  })
  win.once('ready-to-show', () => win?.show())
  // 页面的 console 也进 cordis 的日志，名字是 renderer。electron 的级别名只有 warning 和 cordis 不同
  win.webContents.on('console-message', (event) => {
    const method = event.level === 'error' ? 'error' : event.level === 'warning' ? 'warn' : event.level === 'debug' ? 'debug' : 'info'
    ctx.logger('renderer')[method](event.message)
  })
  win.on('closed', () => {
    win = null
  })
  await win.loadFile(path.join(here, 'index.html'))

  loaderFiber = await ctx.plugin(Loader, {})
  // 主进程没有 --expose-internals，loader 拿不到 node 内部的 ESM loader，那时它按自己的位置
  // 解析包名，插件静默加载失败。内核替它提供一个 import：按 home 把包名解析成真实路径再 import，
  // 实现在 bare-import.ts（有单元测试）
  ctx.loader.internal = { import: bareImportFromHome(dataDir) } as unknown as ModuleLoader
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])
  await ctx.loader.await()
  kernelLog.info(`up，home=${dataDir}，外壳=${shellUrl ?? '（没有插件调用 setShell）'}`)
  pushShell()
}

// 不能顶层 await：Electron 的 ready 要等入口模块求值完才触发，顶层等 ready 会互相等待、卡死
void app
  .whenReady()
  .then(main)
  .catch((err: unknown) => {
    say('error', 'kernel', `启动失败：${stackOf(err)}`)
    // 窗口可能还没打开，页面显示不了；Electron 保证这个对话框在 ready 之前也能弹出
    dialog.showErrorBox('gwb 启动失败', `${stackOf(err)}\n\n日志：${path.join(dataDir, 'gwb.log')}`)
    app.exit(1)
  })
app.on('window-all-closed', () => app.quit())

/**
 * 退出时卸载自己创建的 cordis 运行时：卸载 loader 的 fiber，整棵插件树的清理 effect 逐层执行完——
 * 插件启动的长期子进程靠这一步结束，不然主进程一退它们就成了孤儿进程。谁创建了 Context 谁负责卸载，
 * 见文档站
 */
let quitting = false
app.on('will-quit', (event) => {
  // 清理完之后的 app.quit() 会再次进入 will-quit（quitting 让它通过）；main() 还没加载 loader
  // （启动慢、刚启动就退出）时没有要卸载的，同样放行
  if (quitting || loaderFiber === undefined) return
  event.preventDefault()
  quitting = true
  // 取一份非空的引用给闭包用（模块级 let 的类型收窄传不进闭包）
  const fiber = loaderFiber
  // dispose() 只是**开始**卸载，要再 await() 才等得到嵌套的异步清理；插件那边也要把清理的 promise
  // **返回**出来（effect 的清理函数返回 promise），两边缺一不可（实测数据见文档站）。
  // 某个插件的清理卡住时 5 秒超时：超时就直接退出，工作台不能一直不退
  void Promise.race([
    fiber
      .dispose()
      .then(() => fiber.await())
      .catch((err) => kernelLog.warn(`退出时清理出错：${stackOf(err)}`)),
    new Promise<void>((resolve) => setTimeout(resolve, 5000)),
  ]).then(() => {
    kernelLog.info('清理完成，退出')
    app.quit()
  })
})
