import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import { parseCommandLine, type HostMessage } from '../shared/protocol'
import { pluginDir, pluginMeta } from '../shared/entries'
import { ensureHomeManifest, homeInstalled, installPackages, RECOMMENDED } from './install'

/**
 * 宿主子进程入口（纯 node，由主进程以 ELECTRON_RUN_AS_NODE 拉起）。
 * 内核只挂两个官方件就退场:loader 管条目树与模块加载,include 读 yml。
 * 取址因此归 loader——baseUrl 指向 home,它自己解析 <home>/node_modules。
 */

// cordis 的 logger 走 console.log——先改道 stderr，别污染 fd1
console.log = console.error

const dataDir = process.env.GWB_DATA_DIR ?? path.resolve(process.cwd(), 'gwb-home')
const appVersion = process.env.GWB_VERSION ?? null
const siteDir = path.join(dataDir, 'node_modules')
/** 相对 baseUrl 的 URL,不是文件系统路径——include 拿它走 `new URL(path, baseUrl)`，Windows 盘符会被当成 scheme */
const CONFIG_NAME = 'cordis.yml'
/** 承载 cordis.yml 那条条目的 id;件的 id 都挂在它下面（`home:<件>`）*/
const ENTRY_ROOT = 'home'

fs.mkdirSync(dataDir, { recursive: true })

// 显式给 fd 时 path 被忽略
const out = fs.createWriteStream('', { fd: 3, encoding: 'utf8' })
out.on('error', (e) => console.error(`[fd3] ${e.message}`))

function send(message: HostMessage): void {
  out.write(JSON.stringify(message) + '\n')
}

const ctx = new Context()

/**
 * 模块解析的起点,设在根上下文:loader 与 include 都从这儿继承。
 * 指向 home 那个目录,<home>/node_modules 里的件因此按裸名就找得到——母仓设的是应用目录,
 * 所以它必须自己把条目名算成绝对 file URL。
 * 设在根而不是只传给 Loader:Loader 只把它设在自己 extend 出的 ctx 上,而 Include 挂在根上。
 */
ctx.baseUrl = pathToFileURL(dataDir + path.sep).href

declare module 'cordis' {
  interface Context {
    cli?: { run(command: string, args?: unknown): Promise<unknown> }
  }
}

/** 一条条目在界面上的样子。ok 看 fiber:挂上了才有,这是 loader 唯一的成败凭据 */
interface EntryView {
  id: string
  ok: boolean
  pkg: string
  shell: boolean
  disabled: boolean
}

/** 走遍 loader 的条目树（include 是挂在它下面的子树,条目在子树里）*/
function walkEntries(): EntryView[] {
  const out: EntryView[] = []
  const seen = new Set<unknown>()
  const walk = (tree: { store?: Record<string, unknown> } | undefined): void => {
    if (tree === undefined || seen.has(tree)) return
    seen.add(tree)
    for (const raw of Object.values(tree.store ?? {})) {
      const entry = raw as {
        id?: string
        fiber?: unknown
        disabled?: boolean
        options?: { name?: string }
        subtree?: { store?: Record<string, unknown> }
      }
      const pkg = entry.options?.name ?? ''
      out.push({
        id: entry.id ?? '',
        ok: entry.fiber !== undefined,
        pkg,
        shell: pkg === '' ? false : pluginMeta(pluginDir(pkg, siteDir))?.shell === true,
        disabled: entry.disabled === true,
      })
      walk(entry.subtree)
    }
  }
  walk(ctx.loader as unknown as { store?: Record<string, unknown> })
  return out
}

/** 内核自省口。除它与 kernel.install 之外一律走 ctx.cli——本体不认识任何插件的命令名 */
function kernelInfo(): unknown {
  const entries = walkEntries()
  return {
    ok: true,
    data: { pid: process.pid, node: process.versions.node, dataDir, appVersion, entries },
  }
}

const installEnv = {
  homeDir: dataDir,
  pnpm: process.env.GWB_PNPM ?? '',
  log: (line: string) => console.error(`[install] ${line}`),
}

/** 装机口。装完的件要生效,改 yml 让 include 重挂——装机本身不碰条目树 */
async function kernelInstall(args: unknown): Promise<unknown> {
  const specs = (args as { specs?: unknown })?.specs
  if (!Array.isArray(specs) || specs.some((s) => typeof s !== 'string')) {
    return { ok: false, error: 'kernel.install 要 { specs: string[] }' }
  }
  if (installEnv.pnpm === '') return { ok: false, error: '没有可用的 pnpm（GWB_PNPM 没传下来）' }
  const result = await installPackages(installEnv, specs as string[])
  return result.ok ? { ok: true, data: { installed: specs } } : result
}

async function dispatch(payload: { command: string; args?: unknown }): Promise<unknown> {
  if (payload.command === 'kernel.info') return kernelInfo()
  if (payload.command === 'kernel.install') return kernelInstall(payload.args)
  const cli = ctx.cli
  if (!cli) return { ok: false, error: `没有命令服务，认不出 ${payload.command}` }
  return cli.run(payload.command, payload.args)
}

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  if (!line.trim()) return
  const msg = parseCommandLine(line)
  // 协议两头都是自家写的，不成话的行就是有一边有 bug，丢掉等于藏 bug
  if (msg === undefined) {
    console.error(`[stdin] 不合协议的行，已丢弃：${line.slice(0, 200)}`)
    return
  }
  void dispatch(msg.payload).then(
    (result) => send({ t: 'reply', id: msg.id, result }),
    (err: unknown) => send({ t: 'reply', id: msg.id, result: { ok: false, error: String(err) } }),
  )
})

/**
 * 首启:home 还不是个包就建出来,按推荐列表装一遍。装过了一概不碰——不自动升级。
 * 建 package.json 排在装之前而且不由装机代劳:推荐列表空的时候也得建出来,
 * 不然「装过了」永远判不成立,每次启动都当新 home。
 */
async function firstRun(): Promise<void> {
  if (homeInstalled(dataDir)) return
  console.error(`[install] 新 home:${dataDir}`)
  ensureHomeManifest(dataDir)
  await installPackages(installEnv, [...RECOMMENDED])
}

/**
 * 内核只挂 loader,再往它的树上放一条 include,其余全归这两个。
 *
 * include 走 `cordis:` 前缀的内建表:那个前缀的名字 loader 直接从 builtins 里取,
 * 不经模块解析——它住应用依赖树而 baseUrl 指着 home,按裸名是找不到的。
 * 做成条目而不是 `ctx.plugin(Include)`,是为了让它的子树挂在 loader 的树上:
 * 条目表、fiber 状态、热挂卸全在一棵树里,外面只认 ctx.loader 一个入口。
 */
async function bootLoader(): Promise<void> {
  // ctx.plugin 是 thenable,不 await 服务就还没就位（ctx.loader 会是 undefined）
  await ctx.plugin(Loader, {})
  ctx.loader.builtins.include = Include
  // id 写死:条目 id 是有层级的（`<父>:<子>`），父的 id 一变，所有件的 id 跟着变——
  // 外壳的布局按 panel id 存,那样每次启动都对不上
  await ctx.loader.root.update([{ id: ENTRY_ROOT, name: 'cordis:include', config: { path: CONFIG_NAME } }])
  await ctx.loader.await()
}

void firstRun()
  .then(bootLoader)
  .then(() => {
    const entries = walkEntries()
    console.error(`[host] up，dataDir=${dataDir}，条目 ${entries.filter((e) => e.ok).length}/${entries.length}`)
    for (const e of entries) console.error(`[host]   ${e.ok ? '挂上' : '没挂'} ${e.id}（${e.pkg}）`)
    send({ t: 'ready' })
  })
  .catch((err: unknown) => {
    console.error(`[host] 起不来：${String(err)}`)
    process.exit(1)
  })
