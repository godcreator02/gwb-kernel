import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import { inspect } from 'node:util'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import type { GwbKernelApi } from '@godcreator02/gwb-plugin-api'
import { asLogLevel, formatLogLine, parseCommandLine, type HostMessage, type LogLine } from '../shared/protocol'
import { pluginDir, pluginMeta } from '../shared/entries'
import { CONFIG_NAME, ensureHome, homeExists, README_NAME } from './home'

/**
 * 宿主子进程入口（纯 node，由主进程以 ELECTRON_RUN_AS_NODE 拉起）。
 * 挂 loader 与 include，provide gwbKernel，守住 fd3 那条命令通道。
 * 取舍与踩过的坑见文档站。
 */

const dataDir = process.env.GWB_DATA_DIR ?? path.resolve(process.cwd(), 'gwb-home')
/** 日志目录。宿主自己不往那儿写，只是经 `kernel.info` 把路径转交给件——件别自己拼 */
const logDir = process.env.GWB_LOG_DIR ?? ''
const appVersion = process.env.GWB_VERSION ?? null
const siteDir = path.join(dataDir, 'node_modules')
/** 承载 cordis.yml 那条条目的 id；件的 id 挂在它下面（`home:<件>`） */
const ENTRY_ROOT = 'home'

/**
 * 外壳这个角色的服务名。**谁 provide 了它谁就是外壳**——这是内核认识的唯一一个件的
 * 名字，它总得挑一个件把 `#root` 交出去。
 *
 * 不绑包名：另一个外壳件叫什么都行，provide 这个名字就是。
 */
const SHELL_SERVICE = 'gwbShell'

fs.mkdirSync(dataDir, { recursive: true })

// 显式给 fd 时 path 被忽略
const out = fs.createWriteStream('', { fd: 3, encoding: 'utf8' })
/**
 * 这一处**故意不走 `ctx.logger`**：日志出口自己要往 fd3 投一份，fd3 坏了再经它报错就是
 * 写失败 → 报错 → 再写 → 再失败的死循环。裸写 stderr 是这条线上唯一没有回环的出路。
 */
out.on('error', (e) => process.stderr.write(`[fd3] ${e.message}\n`))

function send(message: HostMessage): void {
  out.write(JSON.stringify(message) + '\n')
}

const ctx = new Context()

/** 模块解析的起点，指向 home 目录。设在根上下文，loader 与 include 都从这儿继承 */
ctx.baseUrl = pathToFileURL(dataDir + path.sep).href

/**
 * 内核自己用的 logger 名。**这张表决定一条日志算 `host` 还是 `plugin`**——表里的是内核在
 * 说话，其余一律是件。`loader` 也算内核的：它报的是引导链的事（哪个件挂不上），不是某个
 * 件自己在说话。
 */
const KERNEL_LOGGERS = new Set(['host', 'stdin', 'loader'])

/** cordis 递给 exporter 的那条消息，只取用得上的几样 */
interface LogMessage {
  ts?: number
  name?: string
  type?: string
  args?: unknown[]
}

interface CordisExporter {
  colors: number
  levels: { default: number }
  formatters: Record<string, (value: unknown) => string>
  export(message: LogMessage): void
}

/**
 * cordis 的 `Logger` 类，从一个实例的 `constructor` 上取——**这样就不必 `import` cordis 的
 * 内部**。`format` 是静态方法，整个渲染都在它里面。
 */
interface LoggerCtor {
  format(exporter: CordisExporter, message: LogMessage): string
}

/**
 * `%o` / `%O` 的渲染。cordis 默认拿 `JSON.stringify` 干这活，**撞上循环引用会抛，而且抛在
 * 调用 `logger.info()` 的那一行**——打个日志把业务代码炸了。换成 `inspect` 顺带把
 * `[object Object]` 变成真的对象转储。
 */
function inspectArg(value: unknown): string {
  return inspect(value, { depth: 2, colors: false })
}

/**
 * **内核唯一的日志出口**，一处两投：stderr（→ 终端，劫持之后顺带进文件）与 fd3（→ 主进程的
 * 缓冲 → 窗格）。两处的**正文是同一个字符串**，终端那份只多一段前缀。
 *
 * 它必须在**任何件之前**就位——第一个件挂不上的那一刻，负责好格式的件本身可能还没挂上。
 * 所以注册点在这儿，紧挨着 `ctx` 造出来的地方；这样 cordis 自带的那圈 buffer 里根本攒不下
 * 东西，也就不必回头去补发。取舍见文档站。
 */
function bootstrapLogExporter(): void {
  const factory = ctx.logger as unknown as {
    (name: string): { constructor: LoggerCtor }
    exporter(exp: unknown): void
  }
  // 整个拿着这个类、不把 format 摘下来：静态方法摘下来就丢了 this
  const Logger = factory('gwb').constructor
  const exporter: CordisExporter = {
    // 0 而不是带色：这个正文同时投给窗格，ANSI 码到了那边就是一串乱码
    colors: 0,
    // 不设的话 cordis 默认只到 info，**debug 一条都收不到，而且不报错不报警**
    levels: { default: 3 },
    formatters: { o: inspectArg, O: inspectArg },
    export: (message) => {
      const level = asLogLevel(String(message.type ?? 'info'))
      const name = String(message.name ?? 'gwb')
      const ts = typeof message.ts === 'number' ? message.ts : Date.now()
      let msg: string
      try {
        msg = Logger.format(exporter, message)
      } catch {
        // 渲染不出来也得把话说出去
        msg = (message.args ?? []).map((a) => (a instanceof Error ? a.message : String(a))).join(' ')
      }
      const line: LogLine = { ts, source: KERNEL_LOGGERS.has(name) ? 'host' : 'plugin', level, name, msg }
      process.stderr.write(formatLogLine(line) + '\n')
      send({ t: 'log', line })
    },
  }
  factory.exporter(exporter)
}

/**
 * 收编裸 `console.*`。件里有人写 `console.log` 的话,那阵子它只进得了文件（经 stderr
 * 劫持落盘）、进不了窗格——四路里没有它的座位。全转 `ctx.logger('console')` 之后,
 * 它就是正经的 plugin 路一条。
 *
 * **回环已挡**:出口投 stderr 用的是 `process.stderr.write`（见 bootstrapLogExporter）,
 * 不吃这次劫持的亏。`console.log` 归 info 是惯例。放在 exporter 注册**之后**,免得
 * exporter 还没接管时打出的日志绕回默认出口（那才是真回环）。
 */
function adoptConsole(): void {
  // 收窄成 rest 参数的形状:cordis logger 的方法签名不收数组展开,而 console.* 的
  // 语义正好就是「参数列表原样递给渲染」
  const log = ctx.logger('console') as unknown as Record<
    'debug' | 'info' | 'warn' | 'error',
    (...args: unknown[]) => void
  >
  console.debug = (...args) => log.debug(...args)
  console.info = (...args) => log.info(...args)
  console.log = (...args) => log.info(...args)
  console.warn = (...args) => log.warn(...args)
  console.error = (...args) => log.error(...args)
}

bootstrapLogExporter()

adoptConsole()
/**
 * 没人接的 promise rejection **只报不退**。
 *
 * cordis 的 fiber 在 `Fiber.execute` 里抛出的错它自己会 log 一遍，但那条 rejection 同时
 * 是没人接的——node 默认拿它当未捕获异常处理，**整个宿主当场退出**。于是「装了一个会抛
 * 的件」等于「工作台没了」，而件是随时能装进来的。
 *
 * 撞过的现场：给一个 provide 服务的件挂第二条条目，cordis 抛 `service "gwbData" has been
 * registered`，宿主 `code=1` 死掉；那条错**挂在 create 的 promise 之外**，调用方自己
 * `.catch()` 拦不住。
 *
 * 只打一条日志，**不退出、不重挂、不回滚**——盘上对账与失败还原是这个仓明确不做的。
 * 件挂没挂上，看条目表。
 *
 * 只接 `unhandledRejection`，**不接 `uncaughtException`**：后者意味着同步栈已经断了，
 * 那时进程状态可能已经坏了，接住它只会把一个能看见的崩溃变成一个说不清的僵局。
 */
process.on('unhandledRejection', (reason: unknown) => {
  const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
  ctx.logger('host').error(`没人接的 rejection（件挂载失败多半落这儿），宿主继续跑：\n${detail}`)
})

declare module 'cordis' {
  interface Context {
    /** 内核的服务，根上下文 provide、永不撤销 */
    gwbKernel: GwbKernelApi
    /** 命令总线，由某个件提供；没装那个件就是 undefined */
    gwbCommands?: { run(command: string, args?: unknown): Promise<unknown> }
  }
}

/**
 * cordis 的 `FiberState.ACTIVE`。**那是个 `const enum`**，`isolatedModules` 下 import
 * 不进来，所以照抄字面量。
 */
const FIBER_ACTIVE = 2

/** 一条条目在界面上的样子 */
interface EntryView {
  id: string
  /**
   * 真的跑起来了没有。
   *
   * **判的是 fiber 的状态，不是 fiber 在不在**：`registry.plugin()` 是**同步**建 fiber 的，
   * 跟 inject 满不满足无关。按「fiber 在不在」判的话，一个 inject 永远等不到的件也报
   * `ok: true`——而那正是最该被看见的一种没挂上。
   */
  ok: boolean
  pkg: string
  disabled: boolean
}

/** 走遍 loader 的条目树；include 是挂在它下面的子树，件的条目在子树里 */
function walkEntries(): EntryView[] {
  const out: EntryView[] = []
  const seen = new Set<unknown>()
  const walk = (tree: { store?: Record<string, unknown> } | undefined): void => {
    if (tree === undefined || seen.has(tree)) return
    seen.add(tree)
    for (const raw of Object.values(tree.store ?? {})) {
      const entry = raw as {
        id?: string
        fiber?: { state?: number }
        disabled?: boolean
        options?: { name?: string }
        subtree?: { store?: Record<string, unknown> }
      }
      out.push({
        id: entry.id ?? '',
        ok: entry.fiber?.state === FIBER_ACTIVE,
        pkg: entry.options?.name ?? '',
        disabled: entry.disabled === true,
      })
      walk(entry.subtree)
    }
  }
  walk(ctx.loader as unknown as { store?: Record<string, unknown> })
  return out
}

/**
 * 哪个包是外壳：**看谁 provide 了 `gwbShell` 服务**，不看包清单。
 *
 * 内核仍然认识一个名字（以前是 `gwb.shell` 这个字段名，现在是这个服务名）——那是免不了的，
 * 它总得挑一个件把 `#root` 交出去。换成服务名之后白得三样：
 *
 * - **「多于一条」那种局面不存在了**：cordis 的 `provide` 撞名直接抛，第二个 provide
 *   `gwbShell` 的件根本挂不上，而且日志里明说撞的是谁
 * - **半死的外壳挑不出来**：这儿只认 `ACTIVE` 的 fiber。inject 没满足的外壳（比如它等的
 *   命令总线没装）从此报不出来，而不是让渲染层去 boot 一个跑不起来的
 * - **不用每次都重扫盘**：以前每条条目都要读一次它的 `package.json`
 *
 * 全扫再匹配、不用 `ctx.reflect._getImpl()`：那个带下划线、是内部面；而且它按
 * `ctx[symbols.isolate][name]` 取，将来条目配了 isolate realm 就漏。
 * 表的键是 **symbol**，`Object.values` 一个都拿不到，只能 `Reflect.ownKeys`。
 */
function shellPackage(): string | null {
  const store = ctx.reflect.store as unknown as Record<symbol, { name?: string; fiber?: unknown }>
  for (const key of Reflect.ownKeys(store)) {
    if (typeof key !== 'symbol') continue
    const impl = store[key]
    if (impl?.name !== SHELL_SERVICE) continue
    const fiber = impl.fiber as { state?: number; entry?: { options?: { name?: unknown } } } | undefined
    if (fiber?.state !== FIBER_ACTIVE) continue
    const pkg = fiber.entry?.options?.name
    if (typeof pkg === 'string' && pkg !== '') return pkg
  }
  return null
}

/** home 清单里直接装着的包名。共享包不是件、不在条目树上，只能从这儿看见 */
function homeDependencies(): string[] {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, unknown>
    }
    return Object.keys(manifest.dependencies ?? {})
  } catch {
    return []
  }
}

/**
 * 收齐 home 里各包声明的运行时环境：裸名 → 哪个包的哪个子路径。一个裸名只许一个提供方——
 * 撞了的报出来，不静默让谁赢（浏览器那边后来的本来也覆盖不掉，静默的下场是页面上跑的
 * 是哪一份说不清）。内核全程不认识 react 这类名字，只搬运声明。
 *
 * **空声明也算声明**：`gwb.shared` 写 `{}` 的包没有裸名可给，但「我是页面级共享基础
 * 设施」这件事由它自己说了算——sharedPkgs 收的就是这一类，界面据此把它们归进「共享包」
 * 栏目，不跟待挂条目的件混在一处。
 */
function collectShared(): {
  shared: Record<string, { pkg: string; sub: string }>
  conflicts: string[]
  sharedPkgs: string[]
} {
  const shared: Record<string, { pkg: string; sub: string }> = {}
  const conflicts: string[] = []
  const sharedPkgs: string[] = []
  for (const pkg of homeDependencies()) {
    const declared = pluginMeta(pluginDir(pkg, siteDir))?.shared
    if (declared === undefined) continue
    sharedPkgs.push(pkg)
    for (const [bare, sub] of Object.entries(declared)) {
      const prev = shared[bare]
      if (prev !== undefined) {
        conflicts.push(`${bare}：${prev.pkg} 与 ${pkg} 都声明了，只认前者`)
        continue
      }
      shared[bare] = { pkg, sub }
    }
  }
  return { shared, conflicts, sharedPkgs }
}

/** 内核自省口 */
function kernelInfo(): unknown {
  const entries = walkEntries()
  const { shared, conflicts, sharedPkgs } = collectShared()
  return {
    ok: true,
    data: {
      pid: process.pid,
      node: process.versions.node,
      dataDir,
      logDir,
      appVersion,
      entries,
      /** 界面根交给哪个包。没有外壳就是 null，渲染层据此摆阶段页（已装清单） */
      shellPkg: shellPackage(),
      shared,
      sharedConflicts: conflicts,
      /** 声明了 gwb.shared 的包（含空声明）。界面据此分出「共享包」栏目 */
      sharedPkgs,
    },
  }
}

/** 内核给件的那个服务 */
const kernelApi: GwbKernelApi = {
  dataDir,
  appVersion,
  emit: (payload) => send({ t: 'event', payload }),
}

/** 除那条自省命令外一律走 ctx.gwbCommands——本体不认识任何件的命令名 */
async function dispatch(payload: { command: string; args?: unknown }): Promise<unknown> {
  if (payload.command === 'kernel.info') return kernelInfo()
  const bus = ctx.gwbCommands
  if (!bus) {
    // 过去只回给调用方,日志里对不上「宿主在、命令却全废」是因为总线没挂
    ctx.logger('host').warn(`命令 ${payload.command} 没处送：没有命令服务（ctx.gwbCommands），装命令总线件才有`)
    return { ok: false, error: `没有命令服务（ctx.gwbCommands），认不出 ${payload.command}` }
  }
  return bus.run(payload.command, payload.args)
}

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  if (!line.trim()) return
  const msg = parseCommandLine(line)
  if (msg === undefined) {
    ctx.logger('stdin').warn(`不合协议的行，已丢弃：${line.slice(0, 200)}`)
    return
  }
  void dispatch(msg.payload).then(
    (result) => send({ t: 'reply', id: msg.id, result }),
    (err: unknown) => {
      ctx.logger('host').warn(`命令 ${msg.payload.command} 派发异常：${String(err)}`)
      send({ t: 'reply', id: msg.id, result: { ok: false, error: String(err) } })
    },
  )
})

/**
 * 把 home 铺出来。**装机不在这儿**——第一个件怎么进来是件与命令行的事，内核只保证
 * 目录起得来，纸条上写着往下怎么走。
 *
 * `ensureHome` **每次启动都跑**、不只首启：它是幂等的，缺哪样补哪样。只在首启补的话，
 * 有人手工删掉 `cordis.yml` 之后就再也起不来了——而那个失败是宿主整个退出。
 */
function prepareHome(): void {
  const fresh = !homeExists(dataDir)
  ensureHome(dataDir)
  if (fresh) ctx.logger('host').info(`新 home:${dataDir}`)
}

/** 内核只挂 loader，再往它的树上放一条 include，其余全归这两个 */
async function bootLoader(): Promise<void> {
  ctx.provide('gwbKernel', kernelApi)
  await ctx.plugin(Loader, {})
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: ENTRY_ROOT, name: 'cordis:include', config: { path: CONFIG_NAME } }])
  await ctx.loader.await()
}

prepareHome()

void bootLoader()
  .then(() => {
    const log = ctx.logger('host')
    const entries = walkEntries()
    log.info(`up，dataDir=${dataDir}，条目 ${entries.filter((e) => e.ok).length}/${entries.length}`)
    for (const e of entries) log.info(`  ${e.ok ? '挂上' : '没挂'} ${e.id}（${e.pkg}）`)
    /**
     * 一个件都没装的那一刻——阶段页上也只有「还没有装任何件」一句，解释不了怎么装，
     * **这句日志与 home 里那张纸条是仅有的两条出路**。
     *
     * 剔掉内核自己那条 include 条目才是「装了几个件」：`walkEntries` 数得进它。
     */
    if (entries.every((e) => e.id === ENTRY_ROOT)) {
      log.warn(`${CONFIG_NAME} 里一条条目都没有，一个件都没装。怎么装见 ${path.join(dataDir, README_NAME)}`)
    }
    const shell = shellPackage()
    log.info(`外壳：${shell ?? '（没有件 provide gwbShell，界面先给阶段页）'}`)
    send({ t: 'ready' })
  })
  .catch((err: unknown) => {
    /**
     * 这一句**故意不走 `ctx.logger`**：下一行就 `process.exit`，而 fd3 那条流是异步的，
     * 还没冲出去的字节会被截断——最要紧的一条错反而到不了窗格。裸写 stderr 是同步的，
     * 终端与日志文件里一定有。窗格那边看到的是主进程侧那句「宿主退出」。
     */
    process.stderr.write(`[host] 起不来：${String(err)}\n`)
    process.exit(1)
  })
