import electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import Loader, { type Entry, type ModuleLoader } from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import type { GwbKernelApi } from '@godcreator02/gwb-plugin-api'

/**
 * gwb 内核，一个文件：载体、宿主、桥都在这个主进程里，页面是唯一的另一个进程。
 * 只做第一个件跑起来之前必须发生的事：铺 home、起 cordis、挂 loader、开窗、一条命令口、
 * 一条事件口、告诉页面外壳是谁、自己出错时人看得见。其余一律皆件。取舍见文档站。
 */

const { app, BrowserWindow, dialog, ipcMain } = electron
const here = path.dirname(fileURLToPath(import.meta.url))

declare module 'cordis' {
  interface Context {
    /** 内核的服务，根上下文 provide、永不撤销 */
    gwbKernel: GwbKernelApi
    /** 命令总线，由某个件提供；没装那个件就是 undefined */
    gwbCommands?: { run(command: string, args?: unknown): Promise<unknown> }
  }
}

/** 用哪个 home：`GWB_HOME` 是个名字就落 userData/homes/<名>，带路径分隔符就当成目录本身 */
const homeArg = process.env.GWB_HOME ?? 'default'
const dataDir = /[\\/]/.test(homeArg) ? path.resolve(homeArg) : path.join(app.getPath('userData'), 'homes', homeArg)

/** home 起得来的最小形态：包清单、空条目表。缺哪样补哪样，不覆盖 */
fs.mkdirSync(dataDir, { recursive: true })
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

const ctx = new Context()
/** 模块解析的起点指向 home；loader 与 include 都从根上下文继承它 */
ctx.baseUrl = pathToFileURL(dataDir + path.sep).href

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
 * 内核自己的话也走 cordis logger，不直接 say：这样件（比如日志件）挂第二个 exporter 就能收齐
 * 内核、件、渲染层三路，内核不必再为窗格铺任何管道。say 只给 exporter 本身与起不来那一句用
 */
const kernelLog = ctx.logger('kernel')
// 件跑在这个进程里，件的错就是这个进程的错。只记不退：一个坏件不该带走工作台
process.on('unhandledRejection', (e) => kernelLog.error(`没人接的 rejection（件挂载失败多半落这儿）：${stackOf(e)}`))
process.on('uncaughtException', (e) => kernelLog.error(`未捕获异常：${stackOf(e)}`))

/**
 * 浏览器半的取址：页面上的裸名（react 那一族）指到 home 里哪个文件。跟下面替 loader 塞的那五行是同一件
 * 事的两面。提供方在自己的 package.json 里声明 `gwb.shared`（裸名 → exports 子路径），内核扫 home 清单
 * 收齐、解析成 file:// 表，随外壳地址推给页面，页面注完表才 import 外壳。内核不认识 react 这个词，只搬运
 * 声明；共享包没有 node 半，清单是它唯一能说话的地方。撞名只认先到的，报一句
 */
function collectImports(): Record<string, string> {
  const imports: Record<string, string> = {}
  const resolver = createRequire(ctx.baseUrl ?? pathToFileURL(dataDir + path.sep).href)
  let deps: string[] = []
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, unknown>
    }
    deps = Object.keys(manifest.dependencies ?? {})
  } catch {
    /* 没有清单就没有共享包 */
  }
  for (const pkg of deps) {
    let shared: unknown
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(dataDir, 'node_modules', ...pkg.split('/'), 'package.json'), 'utf8'),
      ) as { gwb?: { shared?: unknown } }
      shared = manifest.gwb?.shared
    } catch {
      continue
    }
    if (typeof shared !== 'object' || shared === null) continue
    for (const [bare, sub] of Object.entries(shared as Record<string, unknown>)) {
      if (bare === '' || typeof sub !== 'string' || sub === '') continue
      if (imports[bare] !== undefined) {
        kernelLog.warn(`裸名 ${bare} 有两个提供方，只认先到的，${pkg} 的那条忽略`)
        continue
      }
      try {
        imports[bare] = pathToFileURL(resolver.resolve(`${pkg}/${sub.replace(/^\.\//, '')}`)).href
      } catch (err) {
        kernelLog.warn(`${pkg} 声明的 ${bare} → ${sub} 解析不到：${stackOf(err)}`)
      }
    }
  }
  return imports
}

/**
 * 页面上那份只读现状：条目清单各自到哪一步、最近的错误行。只在没有外壳时画，数据全是内核已经
 * 攥着的（loader 的条目树、logger 的缓冲），不归因、不摆按钮。为什么是这条线，见文档站
 */
interface Report {
  home: string
  entries: { id: string; name: string; state: string }[]
  errors: string[]
}
// 状态词照 cordis 的 FiberState 原名。它是 const enum，isolatedModules 下引不到，数字照它的定义抄；
// _error 与 _store 是 cordis 标了 private 的普通字段（失败原因、已就位的 inject）
const FIBER_STATE = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING'] as const
interface FiberPeek {
  state: number
  inject: Record<string, unknown>
  _error?: unknown
  _store?: Record<string, unknown>
}
function describe(entry: Entry): string {
  if (entry.disabled) return 'disabled'
  const fiber = entry.fiber as unknown as FiberPeek | undefined
  if (fiber === undefined) return 'no fiber（import 失败，原因在错误行里）'
  const state = FIBER_STATE[fiber.state] ?? `state=${String(fiber.state)}`
  if (state === 'PENDING') {
    const missing = Object.keys(fiber.inject).filter((name) => !(name in (fiber._store ?? {})))
    return `PENDING（缺 ${missing.length > 0 ? missing.join('、') : '？'}）`
  }
  if (state === 'FAILED') return `FAILED：${stackOf(fiber._error).split('\n')[0] ?? ''}`
  return state
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
    entries: entries.map((e) => ({ id: e.id, name: e.options.name, state: describe(e) })),
    errors,
  }
}

let win: electron.BrowserWindow | null = null
/** 页面根交给谁。件经 setShell 说，页面经 onShell 听 */
let shellUrl: string | null = null
/** 推给页面的那一份：外壳地址加 importmap 加只读现状。每次现算，共享包装了要重启才看得见 */
const shellMessage = (): { url: string | null; imports: Record<string, string>; report: Report } => ({
  url: shellUrl,
  imports: collectImports(),
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
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: { preload: path.join(here, 'preload.cjs') },
  })
  // 渲染层的 console 也归进 cordis logger 那条流，名字 renderer。electron 的级别词只有 warning 一个跟 cordis 不同
  win.webContents.on('console-message', (event) => {
    const method = event.level === 'error' ? 'error' : event.level === 'warning' ? 'warn' : event.level === 'debug' ? 'debug' : 'info'
    ctx.logger('renderer')[method](event.message)
  })
  win.on('closed', () => {
    win = null
  })
  await win.loadFile(path.join(here, 'index.html'))

  await ctx.plugin(Loader, {})
  // 主进程没有 --expose-internals，loader 拿不到 node 内部的 ESM loader，那时它按自己的位置
  // 解析裸名、件静默挂不上。内核替它：按 home 的 CJS 条件解析到文件，再按 ESM import
  ctx.loader.internal = {
    import: (name: string, base: string) => import(pathToFileURL(createRequire(base).resolve(name)).href),
  } as unknown as ModuleLoader
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
