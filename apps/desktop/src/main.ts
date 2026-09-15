import electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context, type Fiber } from 'cordis'
import Loader, { type ModuleLoader } from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import type { GwbKernelApi } from '@godcreator/gwb-plugin-api'
import { collectImports } from './imports.js'
import { bareImportFromHome } from './bare-import.js'
import { describeEntry, type EntryStatus } from './entry-state.js'

/**
 * gwb 内核的主进程入口：载体、宿主、桥都在这个进程里，页面是唯一的另一个进程；不带
 * electron 的纯函数住旁边几个模块（imports / bare-import / entry-state），各自可单测。
 * 只做第一个件跑起来之前必须发生的事：铺 home、起 cordis、挂 loader、开窗、一条命令口、
 * 一条事件口、告诉页面外壳是谁、自己出错时人看得见。其余一律皆件。取舍见文档站
 */

const { app, BrowserWindow, Menu, dialog, ipcMain } = electron
const here = path.dirname(fileURLToPath(import.meta.url))

declare module 'cordis' {
  interface Context {
    /** 内核的服务，根上下文 provide、永不撤销 */
    gwbKernel: GwbKernelApi
    /** 命令总线，由某个件提供；没装那个件就是 undefined */
    gwbCommands?: { run(command: string, args?: unknown): Promise<unknown> }
  }
}

/** 用哪个 home：`GWB_HOME` 是个名字就落 appData/gwb-kernel/homes/<名>，带路径分隔符就当成目录本身 */
const homeArg = process.env.GWB_HOME ?? 'default'
const homePath = /[\\/]/.test(homeArg) ? path.resolve(homeArg) : path.join(app.getPath('appData'), 'gwb-kernel', 'homes', homeArg)
fs.mkdirSync(homePath, { recursive: true })
// realpath 把大小写、junction、斜杠写法都钉到磁盘上的真实路径：同一 home 的两种给法必须归成
// 同一个串，下面那把按 userData 生效的单开锁才认得出「同一个 home」
const dataDir = fs.realpathSync.native(homePath)

/**
 * Chromium 的 userData 拆成每 home 一份（<home>/electron）：单开锁的钥匙，多 home 并跑不串
 * Local Storage。homes 的根从 appData 推、不从 userData 推——userData 已按 home 拆，从它推就递归了
 */
app.setPath('userData', path.join(dataDir, 'electron'))

/** home 起得来的最小形态：包清单、空条目表。缺哪样补哪样，不覆盖 */
for (const [file, content] of [
  ['package.json', '{\n  "name": "gwb-home",\n  "private": true\n}\n'],
  ['cordis.yml', '[]\n'],
] as const) {
  const target = path.join(dataDir, file)
  if (!fs.existsSync(target)) fs.writeFileSync(target, content)
}

/** 内核唯一的日志出口：stderr 加 home 里一个只追加的文件。一个件都没有时人也看得见 */
const logFd = fs.openSync(path.join(dataDir, 'gwb.log'), 'a')
function say(level: string, name: string, msg: string): void {
  const line = `${new Date().toISOString()} ${level} ${name} ${msg}\n`
  process.stderr.write(line)
  fs.writeSync(logFd, line)
}
const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))
// stderr 对端断了（无终端起）每写一次抛一次 EPIPE，吞掉，文件那投照旧
process.stderr.on('error', () => {})

/**
 * 同一 home 只许一个实例：Electron 的平台锁，钥匙是上面那份 per-home userData。第二个实例
 * 拿不到锁就报一句、退出码 1、不动 runtime.json；在跑那份收到 second-instance 把窗抬到前面。
 * 不手搓锁文件（判据见文档站）
 */
if (!app.requestSingleInstanceLock()) {
  say('error', 'kernel', `home ${dataDir} 已有实例在跑，本实例退出`)
  app.exit(1)
}

/**
 * 这一轮的运行时身份落 `runtime.json`：pid、起的时刻、版本、应用目录，外加 Chromium 调试口
 * ——那个口只有起进程的这只手知道，内核不认识它、页面也读不到。**每次开机整份重写**（与上面
 * 两件套「缺什么补什么」相反：那是 home 的家当，这是此刻这个进程的身份）；退出不删，读的人
 * 负责验活；写不动只报一句就走。判据见文档站
 */
const cdpPort = Number(app.commandLine.getSwitchValue('remote-debugging-port'))
try {
  fs.writeFileSync(
    path.join(dataDir, 'runtime.json'),
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: Date.now(),
        // app.getVersion() 读的是内核包自己的清单：从仓里起还是从安装位起，都报得出自己是哪一版
        version: app.getVersion(),
        appDir: app.getAppPath(),
        // 没开这道口就没有这一格：写 0 或 null 的话，读的人还得再判一次「这个数算不算数」
        ...(Number.isInteger(cdpPort) && cdpPort > 0 && cdpPort < 65536 ? { cdp: cdpPort } : {}),
      },
      null,
      2,
    ) + '\n',
  )
} catch (err) {
  say('warn', 'kernel', `runtime.json 写不动：${stackOf(err)}`)
}

const ctx = new Context()
/** 模块解析的起点指向 home；loader 与 include 都从根上下文继承它 */
ctx.baseUrl = pathToFileURL(dataDir + path.sep).href
/** 挂上的 loader 的 fiber，退出时（will-quit）拆它收走整棵件树；main() 走到挂载那步之前是 undefined */
let loaderFiber: Fiber | undefined

// cordis 的日志全量进 say。渲染交给 cordis 自己的 Logger.format（%s、%o、Error 它都会），
// 类从一个实例的 constructor 上取，免得 import cordis 的内部。buffer 是 cordis 自带的环形缓冲，
// 页面上那份只读现状从这儿筛错误行
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
    // 错误行是页面那份只读现状的一部分，来一条就重推一次（去抖）
    if (message.type === 'error' || message.type === 'warn') pushShell()
  },
}
factory.exporter(exporter)

/**
 * 内核自己的话也走 cordis logger，不直接 say：任何件挂一个 exporter 就收齐内核、件、渲染层
 * 三路，内核不为窗格铺任何管道。say 只给 exporter 本身与起不来那一句用。见文档站
 */
const kernelLog = ctx.logger('kernel')
// 件跑在这个进程里，件的错就是这个进程的错。只记不退：一个坏件不该带走工作台
process.on('unhandledRejection', (e) => kernelLog.error(`没人接的 rejection（件挂载失败多半落这儿）：${stackOf(e)}`))
process.on('uncaughtException', (e) => kernelLog.error(`未捕获异常：${stackOf(e)}`))

/**
 * 页面上那份只读现状：条目清单各自到哪一步、最近的错误行。只在没有外壳时画，数据全是内核已经
 * 攥着的（loader 的条目树、logger 的缓冲），不归因、不摆按钮。为什么是这条线，见文档站
 */
interface Report {
  home: string
  entries: EntryStatus[]
  errors: string[]
}
function report(): Report {
  // 页面的第一声 hello 可能早于 loader 挂上，那时服务还不在
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
// 第二实例被锁拒时 Electron 会通知第一实例：把已在跑的窗抬到前面，人第二次双击看到的是原窗聚焦
app.on('second-instance', () => {
  if (win === null) return
  win.show()
  win.focus()
})
/** 页面根交给谁。件经 setShell 说，页面经 onShell 听 */
let shellUrl: string | null = null
/** 推给页面的那一份：外壳地址加 importmap 加只读现状。每次现算，共享包装了要重启才看得见 */
const shellMessage = (): { url: string | null; imports: Record<string, string>; report: Report } => ({
  url: shellUrl,
  imports: collectImports({ dataDir, baseUrl: ctx.baseUrl, warn: (msg) => kernelLog.warn(msg) }),
  report: report(),
})
// 条目换态、错误行到来都会重推，去抖成一次；页面那头外壳在时不看 report
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

/** 桥：命令一律派给 ctx.gwbCommands，内核不认识任何件的命令名 */
ipcMain.handle('gwb:command', (_event, command: unknown, args: unknown) => {
  if (typeof command !== 'string') return { ok: false, error: '命令名要是字符串' }
  const bus = ctx.gwbCommands
  if (bus === undefined) return { ok: false, error: `没有命令服务（ctx.gwbCommands），认不出 ${command}` }
  return bus.run(command, args)
})
/** 页面订上 onShell 时问一次当前值 */
ipcMain.on('gwb:hello', (event) => event.sender.send('gwb:shell', shellMessage()))

async function main(): Promise<void> {
  // Electron 在应用没设菜单时兜一套默认菜单（File/Edit/View/Window）：没人订，撤成 null。
  // 退默认不是代办——菜单归件，谁要谁自己 setApplicationMenu 盖上来（须在 ready 之后调，main 正好）
  Menu.setApplicationMenu(null)
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    // 窗底取令牌暗色那档井色（tokens.css 的 --background ≈ #151518），与 index.html 的
    // html 背景同一个值：窗口创建到首帧之间、最小化还原的空档、整页 reload 的第一帧，
    // 露出来的都是它而不是白。默认主题若换了底色，这里跟 index.html 一起改
    backgroundColor: '#151518',
    // 首帧画好再亮窗（ready-to-show），启动那一刻也不露白
    show: false,
    webPreferences: { preload: path.join(here, 'preload.cjs') },
  })
  win.once('ready-to-show', () => win?.show())
  // 渲染层的 console 也归进 cordis logger 那条流，名字 renderer。electron 的级别词只有 warning 一个跟 cordis 不同
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
  // 解析裸名、件静默挂不上。内核替它塞一个 import：裸名怎么解成真实路径并 import 进来，
  // 单独住 bare-import.ts（可单测）
  ctx.loader.internal = { import: bareImportFromHome(dataDir) } as unknown as ModuleLoader
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])
  await ctx.loader.await()
  kernelLog.info(`up，home=${dataDir}，外壳=${shellUrl ?? '（没有件调 setShell）'}`)
  pushShell()
}

// 不能顶层 await：Electron 的 ready 要等入口模块求值完才发，顶层等 ready 就互相等死
void app
  .whenReady()
  .then(main)
  .catch((err: unknown) => {
    say('error', 'kernel', `起不来：${stackOf(err)}`)
    // 窗可能还没开，页面画不了；Electron 保证这个框 ready 之前就能弹
    dialog.showErrorBox('gwb 起不来', `${stackOf(err)}\n\n日志：${path.join(dataDir, 'gwb.log')}`)
    app.exit(1)
  })
app.on('window-all-closed', () => app.quit())

/**
 * 退出时收走自己起的 cordis 运行时：拆 loader 的 fiber，整棵件树的收尾 effect 递归跑完——
 * 件起的长命子进程靠这条路被带走，不然主进程一退它们就是孤儿。谁起了 Context 谁收
 * Context，见文档站
 */
let quitting = false
app.on('will-quit', (event) => {
  // 收完尾的 app.quit() 会二次进 will-quit（quitting 放它过去）；main() 还没挂上 loader
  // （起得慢、起来就退）时没有可拆的，同样放行
  if (quitting || loaderFiber === undefined) return
  event.preventDefault()
  quitting = true
  // 闭包里拿得住的非空那份（模块级的 let 收窄不进闭包）
  const fiber = loaderFiber
  // dispose() 只把拆卸**启动**，补 await() 才等得到嵌套的异步收尾；件那半还得把真收尾
  // **返回**出来（effect 清理回 promise），两半缺一不可（实测读数见文档站）。
  // 某个件的收尾挂死时 5 秒超时兜底：超时就硬退，工作台不能赖着不走
  void Promise.race([
    fiber
      .dispose()
      .then(() => fiber.await())
      .catch((err) => kernelLog.warn(`退出收尾出错：${stackOf(err)}`)),
    new Promise<void>((resolve) => setTimeout(resolve, 5000)),
  ]).then(() => {
    kernelLog.info('收尾完，退出')
    app.quit()
  })
})
