import electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context, type Fiber } from 'cordis'
import Loader, { type ModuleLoader } from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import type { GwbKernelApi } from './api.js'
import { createBrowserImports } from './browser-imports.js'
import { createRequests } from './requests.js'
import { homePathFor } from './home-path.js'
import { bareImportFromHome } from './bare-import.js'
import { describeEntry, type EntryStatus } from './entry-state.js'
import { LOG_LIMIT_BYTES, openLogFile, type LogFile } from './log-file.js'
import { isReloadOfCurrentDocument, isTopFrame, opensInSystemBrowser } from './page-boundary.js'

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = electron
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
/** 本包清单在 dist/ 的上一级；不读安装包外层应用的清单 */
const kernelPackageDir = path.join(moduleDir, '..')
const kernelManifest = JSON.parse(fs.readFileSync(path.join(kernelPackageDir, 'package.json'), 'utf8')) as { version: string }
const kernelVersion = kernelManifest.version

declare module 'cordis' {
  interface Context {
    /** 内核的服务，在根上下文上提供、永不撤销 */
    gwbKernel: GwbKernelApi
    /** 命令总线，由命令插件提供；home 里没有命令插件时是 undefined。页面发来的命令带 `{ via: 'ui' }`，处理函数据此认出来自界面 */
    gwbCommands?: { run(command: string, args?: unknown, context?: { via: 'ui' }): Promise<unknown> }
  }
}

const RECENT_ERROR_LINES_SHOWN = 20
const SHELL_PUSH_DEBOUNCE_MS = 200
const QUIT_CLEANUP_TIMEOUT_MS = 5000

/** 由安装步骤或 devkit.home.new 写好，内核只检查、不补 */
const HOME_FILES_REQUIRED_AT_BOOT = ['package.json', 'cordis.yml'] as const

const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))

const homePath = homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData'))
fs.mkdirSync(homePath, { recursive: true })
// 单实例锁按 userData 区分：同一个 home 的不同写法（大小写、junction、斜杠）必须 realpath 成同一个字符串
const dataDir = fs.realpathSync.native(homePath)
app.setPath('userData', path.join(dataDir, 'electron'))

// 没有终端时每写一次 stderr 都抛 EPIPE，忽略它，日志文件照常写
process.stderr.on('error', () => {})

const logFile = openLogFileOrExit(path.join(dataDir, 'gwb.log'))

/** 日志文件用不了：只写 stderr 再弹框退出，不经 reportBootFailureAndExit（它要写这个文件） */
function openLogFileOrExit(file: string): LogFile {
  try {
    return openLogFile({
      file,
      limitBytes: LOG_LIMIT_BYTES,
      // 不走 writeLogLine：它也写这个文件，出错时会再次进入自己
      onWarn: (message) => {
        process.stderr.write(`${new Date().toISOString()} warn kernel ${message}\n`)
      },
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${new Date().toISOString()} error kernel 启动失败：${reason}\n`)
    dialog.showErrorBox('gwb 启动失败', reason)
    app.exit(1)
    // 模块求值时 app.exit 当场结束进程、走不到这一行；throw 让这条路径在类型上不返回
    throw err
  }
}

/** cordis 实例建好之前、以及启动失败时才直接调用；其余日志一律走 cordis logger，注册了 exporter 的插件才收得到 */
function writeLogLine(level: string, name: string, message: string): void {
  const line = `${new Date().toISOString()} ${level} ${name} ${message}\n`
  process.stderr.write(line)
  logFile.write(line)
}

if (!app.requestSingleInstanceLock()) {
  writeLogLine('error', 'kernel', `home ${dataDir} 已有实例在运行，本实例退出`)
  app.exit(1)
}

const missingHomeFiles = HOME_FILES_REQUIRED_AT_BOOT.filter((file) => !fs.existsSync(path.join(dataDir, file)))
if (missingHomeFiles.length > 0) {
  reportBootFailureAndExit(
    `home ${dataDir} 里缺 ${missingHomeFiles.join('、')}。package.json 与 cordis.yml 由安装步骤（INSTALL.md）或 devkit.home.new 准备，内核不补`,
  )
}

/** 开关原值要是十进制整数且在 1–65535 之间 */
function isPortNumber(switchValue: string): boolean {
  if (!/^[0-9]+$/.test(switchValue)) return false
  const port = Number(switchValue)
  return port >= 1 && port <= 65535
}

/** 没给调试端口时不写 `cdp` */
function runtimeRecord(debuggingPort: number | undefined): Record<string, unknown> {
  return {
    pid: process.pid,
    startedAt: Date.now(),
    version: kernelVersion,
    ...(debuggingPort === undefined ? {} : { cdp: debuggingPort }),
  }
}

function writeRuntimeRecord(debuggingPort: number | undefined): void {
  const runtimeFile = path.join(dataDir, 'runtime.json')
  try {
    fs.writeFileSync(runtimeFile, JSON.stringify(runtimeRecord(debuggingPort), null, 2) + '\n')
  } catch (err) {
    reportBootFailureAndExit(`runtime.json 写入失败（${runtimeFile}）：${stackOf(err)}`)
  }
}

// 没给这个开关时是空串
const debuggingPortSwitch = app.commandLine.getSwitchValue('remote-debugging-port')
if (debuggingPortSwitch === '') writeRuntimeRecord(undefined)
else if (isPortNumber(debuggingPortSwitch)) writeRuntimeRecord(Number(debuggingPortSwitch))
else reportBootFailureAndExit(`--remote-debugging-port 给的是 ${JSON.stringify(debuggingPortSwitch)}，不是 1–65535 的整数`)

const ctx = new Context()
// loader 与 include 从根上下文继承这个模块解析起点
ctx.baseUrl = pathToFileURL(dataDir + path.sep).href
let loaderFiber: Fiber | undefined

interface CordisLogMessage {
  ts?: number
  type?: string
  name?: string
  args?: unknown[]
}
const cordisLoggerService = ctx.logger as unknown as {
  (name: string): { constructor: { format(exporter: unknown, message: unknown): string } }
  exporter(exporter: unknown): void
  buffer: CordisLogMessage[]
}
// Logger 类从一个实例的 constructor 上取，不 import cordis 的内部模块
const CordisLogger = cordisLoggerService('gwb').constructor

function isErrorOrWarning(message: CordisLogMessage): boolean {
  return message.type === 'error' || message.type === 'warn'
}

const gwbLogExporter = {
  colors: 0,
  // 3 是 debug 级：所有级别都写
  levels: { default: 3 },
  export: (message: CordisLogMessage): void => {
    writeLogLine(message.type ?? 'info', message.name ?? '', formatLogMessage(message))
    if (message.type === 'error') scheduleShellPush()
  },
}

function formatLogMessage(message: CordisLogMessage): string {
  // cordis 的 %o 用 JSON.stringify，参数有循环引用、BigInt 就抛；抛出去会让写日志的插件跟着抛，留在缓冲里的那一行还会让每次推送状态页都抛
  try {
    return CordisLogger.format(gwbLogExporter, message)
  } catch {
    return (message.args ?? []).map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ')
  }
}

cordisLoggerService.exporter(gwbLogExporter)

const kernelLog = ctx.logger('kernel')
process.on('unhandledRejection', (e) => kernelLog.error(`没有被处理的 rejection（插件加载失败多半在这里）：${stackOf(e)}`))
process.on('uncaughtException', (e) => kernelLog.error(`未捕获异常：${stackOf(e)}`))

interface StatusPageReport {
  home: string
  entries: EntryStatus[]
  errors: string[]
}

function formatBufferedErrorLine(message: CordisLogMessage): string {
  return `${new Date(message.ts ?? Date.now()).toISOString()} ${message.type ?? ''} ${message.name ?? ''} ${formatLogMessage(message)}`
}

function recentErrorLines(): string[] {
  return cordisLoggerService.buffer.filter(isErrorOrWarning).slice(-RECENT_ERROR_LINES_SHOWN).map(formatBufferedErrorLine)
}

function statusPageReport(): StatusPageReport {
  // 页面第一次请求可能早于 loader 加载，那时服务还不在
  const loader = ctx.loader as typeof ctx.loader | undefined
  const entries = loader === undefined ? [] : [...loader.entries()]
  return {
    home: dataDir,
    entries: entries.map((entry) => ({ id: entry.id, name: entry.options.name, state: describeEntry(entry) })),
    errors: recentErrorLines(),
  }
}

let mainWindow: electron.BrowserWindow | null = null

function bringMainWindowToFront(): void {
  if (mainWindow === null) return
  mainWindow.show()
  mainWindow.focus()
}
app.on('second-instance', () => bringMainWindowToFront())

let currentShellUrl: string | null = null

interface ShellMessage {
  url: string | null
  report: StatusPageReport
}

function currentShellMessage(): ShellMessage {
  return {
    url: currentShellUrl,
    report: statusPageReport(),
  }
}

function pushShellMessageNow(): void {
  mainWindow?.webContents.send('gwb:shell', currentShellMessage())
}

let pendingShellPush: NodeJS.Timeout | null = null
function scheduleShellPush(): void {
  if (pendingShellPush !== null) return
  pendingShellPush = setTimeout(() => {
    pendingShellPush = null
    pushShellMessageNow()
  }, SHELL_PUSH_DEBOUNCE_MS)
}
ctx.on('internal/status', () => scheduleShellPush())

const browserImports = createBrowserImports()
const requests = createRequests()
const kernel: GwbKernelApi = {
  dataDir,
  version: kernelVersion,
  emit: (payload) => mainWindow?.webContents.send('gwb:event', payload),
  handleRequest: (channel, handler) => requests.handle(channel, handler),
  registerImports: (imports) => browserImports.register(imports),
  setShell: (url) => {
    currentShellUrl = url
    pushShellMessageNow()
    return () => {
      if (currentShellUrl !== url) return
      currentShellUrl = null
      pushShellMessageNow()
    }
  },
}
ctx.provide('gwbKernel', kernel)

function relayPageCommand(senderFrame: electron.WebFrameMain | null, command: unknown, args: unknown): unknown {
  if (!isTopFrame(senderFrame)) return { ok: false, error: `gwb:command 只接收顶层框架的调用，${String(command)} 没有执行` }
  if (typeof command !== 'string') return { ok: false, error: '命令名要是字符串' }
  const commandBus = ctx.gwbCommands
  if (commandBus === undefined) return { ok: false, error: `没有命令服务（ctx.gwbCommands），无法执行 ${command}` }
  return commandBus.run(command, args, { via: 'ui' })
}
ipcMain.handle('gwb:command', (event, command: unknown, args: unknown) => relayPageCommand(event.senderFrame, command, args))
ipcMain.handle('gwb:request', (event, channel: unknown, payload: unknown) => {
  if (!isTopFrame(event.senderFrame)) throw new Error('gwb:request 只接收顶层框架的调用')
  return requests.dispatch(channel, payload)
})
ipcMain.handle('gwb:imports', (event) => {
  if (!isTopFrame(event.senderFrame)) throw new Error('gwb:imports 只接收顶层框架的调用')
  return browserImports.snapshot()
})
ipcMain.on('gwb:hello', (event) => event.sender.send('gwb:shell', currentShellMessage()))

/** electron 的级别名只有 warning 与 cordis 不同 */
function cordisLevelOfConsoleLevel(consoleLevel: string): 'error' | 'warn' | 'debug' | 'info' {
  if (consoleLevel === 'error') return 'error'
  if (consoleLevel === 'warning') return 'warn'
  if (consoleLevel === 'debug') return 'debug'
  return 'info'
}

function openInSystemBrowser(url: string): void {
  kernelLog.info(`交给系统浏览器打开 ${url}`)
  shell.openExternal(url).catch((err) => kernelLog.warn(`系统浏览器没能打开 ${url}：${stackOf(err)}`))
}

/** 页面能调用整条命令总线，所以主框架只能是内核的 index.html：跳走、重定向一律拒绝；开新窗口一律 deny，http、https 地址改由系统浏览器打开 */
function lockPageToIndexHtml(webContents: electron.WebContents): void {
  const refuse = (what: string, url: string): void => kernelLog.warn(`页面只能是内核的 index.html，拒绝${what} ${url}`)
  webContents.on('will-navigate', (event) => {
    if (isReloadOfCurrentDocument(event.url, webContents.getURL())) return
    event.preventDefault()
    refuse('主框架跳转到', event.url)
  })
  webContents.on('will-redirect', (event) => {
    if (!event.isMainFrame) return
    event.preventDefault()
    refuse('主框架重定向到', event.url)
  })
  webContents.setWindowOpenHandler(({ url }) => {
    if (opensInSystemBrowser(url)) openInSystemBrowser(url)
    else refuse('打开新窗口', url)
    return { action: 'deny' }
  })
}

function createMainWindow(): electron.BrowserWindow {
  const browserWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    // 与 index.html 的 html 背景、安装包图标的底色是同一个值，改就一起改
    backgroundColor: '#151518',
    show: false,
    webPreferences: { preload: path.join(moduleDir, 'preload.cjs') },
  })
  browserWindow.once('ready-to-show', () => mainWindow?.show())
  lockPageToIndexHtml(browserWindow.webContents)
  browserWindow.webContents.on('console-message', (event) => {
    ctx.logger('renderer')[cordisLevelOfConsoleLevel(event.level)](event.message)
  })
  browserWindow.on('closed', () => {
    mainWindow = null
  })
  return browserWindow
}

async function loadPluginsFromHome(): Promise<void> {
  loaderFiber = await ctx.plugin(Loader, {})
  // 主进程没有 --expose-internals，不设 internal 的话 loader 按自己的位置解析包名，插件静默加载失败
  ctx.loader.internal = { import: bareImportFromHome(dataDir) } as unknown as ModuleLoader
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])
  await ctx.loader.await()
}

async function startAfterAppReady(): Promise<void> {
  // 不设的话 Electron 给一套默认菜单（File/Edit/View/Window）
  Menu.setApplicationMenu(null)
  mainWindow = createMainWindow()
  await mainWindow.loadFile(path.join(moduleDir, 'index.html'))
  await loadPluginsFromHome()
  kernelLog.info(`up，home=${dataDir}，外壳=${currentShellUrl ?? '（没有插件调用 setShell）'}`)
  scheduleShellPush()
}

function reportBootFailureAndExit(err: unknown): void {
  writeLogLine('error', 'kernel', `启动失败：${stackOf(err)}`)
  // 窗口可能还没打开；Electron 保证这个对话框在 ready 之前也能弹出
  dialog.showErrorBox('gwb 启动失败', `${stackOf(err)}\n\n日志：${path.join(dataDir, 'gwb.log')}`)
  app.exit(1)
}

// 不能顶层 await：Electron 的 ready 要等入口模块求值完才触发，顶层等 ready 会互相等待、卡死
void app.whenReady().then(startAfterAppReady).catch(reportBootFailureAndExit)
app.on('window-all-closed', () => app.quit())

/** dispose() 只是开始卸载，要再 await() 才等得到嵌套的异步清理 */
function disposePluginTreeLoggingErrors(fiber: Fiber): Promise<unknown> {
  return fiber
    .dispose()
    .then(() => fiber.await())
    .catch((err) => kernelLog.warn(`退出时清理出错：${stackOf(err)}`))
}

function waitAtMost(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

let quitCleanupStarted = false
app.on('will-quit', (event) => {
  // 清理完调用的 app.quit() 会再次进入这里，那一次放行；loader 还没加载时没有要卸载的，也放行
  if (quitCleanupStarted || loaderFiber === undefined) return
  event.preventDefault()
  quitCleanupStarted = true
  void Promise.race([disposePluginTreeLoggingErrors(loaderFiber), waitAtMost(QUIT_CLEANUP_TIMEOUT_MS)]).then(() => {
    kernelLog.info('清理完成，退出')
    app.quit()
  })
})
