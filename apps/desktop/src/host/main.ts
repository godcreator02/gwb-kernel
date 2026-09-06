import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import { parseCommandLine, type HostMessage } from '../shared/protocol'
import { parseEntries, pluginDir, pluginMeta, resolvePlugin, type Entry } from '../shared/entries'
import { ensureHomeManifest, homeInstalled, installPackages, RECOMMENDED } from './install'

/**
 * 宿主子进程入口（纯 node，由主进程以 ELECTRON_RUN_AS_NODE 拉起）。
 * 载体（起 cordis）+ 取址（读 yml、找到位、挂上）+ 桥的宿主那半。
 */

// cordis 的 logger 走 console.log——先改道 stderr，别污染 fd1
console.log = console.error

const dataDir = process.env.GWB_DATA_DIR ?? path.resolve(process.cwd(), 'gwb-home')
const appVersion = process.env.GWB_VERSION ?? null
const siteDir = path.join(dataDir, 'node_modules')
const configFile = path.join(dataDir, 'cordis.yml')

fs.mkdirSync(dataDir, { recursive: true })

// 显式给 fd 时 path 被忽略
const out = fs.createWriteStream('', { fd: 3, encoding: 'utf8' })
out.on('error', (e) => console.error(`[fd3] ${e.message}`))

function send(message: HostMessage): void {
  out.write(JSON.stringify(message) + '\n')
}

const ctx = new Context()

declare module 'cordis' {
  interface Context {
    cli?: { run(command: string, args?: unknown): Promise<unknown> }
  }
}

/** 挂载结果:每条一句话，说得出为什么没挂上。pkg 与 shell 给渲染层挑外壳用 */
interface Mounted {
  id: string
  ok: boolean
  why?: string
  pkg?: string
  shell?: boolean
}

const mounted: Mounted[] = []

async function mountEntry(entry: Entry): Promise<Mounted> {
  if (entry.disabled === true) return { id: entry.id, ok: false, why: '条目被禁用' }
  const file = resolvePlugin(entry.name, siteDir)
  if (file === undefined) return { id: entry.id, ok: false, why: `位里没有 ${entry.name}（或入口文件不在）` }
  const shell = pluginMeta(pluginDir(entry.name, siteDir))?.shell === true
  try {
    const mod: unknown = await import(pathToFileURL(file).href)
    // 模块的形状运行时才知道,类型上没什么可说的——照 cordis 的约定原样转发
    ;(ctx.plugin as (plugin: unknown, config: unknown) => void)(mod, entry.config ?? {})
    return { id: entry.id, ok: true, pkg: entry.name, shell }
  } catch (err) {
    // 一个坏件不拖垮别的:记下原因，接着挂下一条
    return { id: entry.id, ok: false, why: String(err), pkg: entry.name, shell }
  }
}

async function mountAll(): Promise<void> {
  let entries: Entry[]
  try {
    entries = parseEntries(fs.readFileSync(configFile, 'utf8'))
  } catch (err) {
    // 文件不在就是「一个件都没装」,不写模板——那个文件归用户
    const why = (err as NodeJS.ErrnoException).code === 'ENOENT' ? '还没有这个文件' : String(err)
    console.error(`[host] 插件树读不出（${why}）：${configFile}`)
    return
  }
  for (const entry of entries) {
    const result = await mountEntry(entry)
    mounted.push(result)
    console.error(result.ok ? `[host] 挂上 ${result.id}` : `[host] 没挂 ${result.id}：${result.why}`)
  }
}

/** 内核自省口。除它之外一律走 ctx.cli——本体不认识任何插件的命令名 */
function kernelInfo(): unknown {
  return {
    ok: true,
    data: { pid: process.pid, node: process.versions.node, dataDir, appVersion, entries: mounted },
  }
}

const installEnv = {
  homeDir: dataDir,
  pnpm: process.env.GWB_PNPM ?? '',
  log: (line: string) => console.error(`[install] ${line}`),
}

/** 装机口。装完不重挂:换模块是另一件事,重启就好——真嫌烦了再说 */
async function kernelInstall(args: unknown): Promise<unknown> {
  const specs = (args as { specs?: unknown })?.specs
  if (!Array.isArray(specs) || specs.some((s) => typeof s !== 'string')) {
    return { ok: false, error: 'kernel.install 要 { specs: string[] }' }
  }
  if (installEnv.pnpm === '') return { ok: false, error: '没有可用的 pnpm（GWB_PNPM 没传下来）' }
  const result = await installPackages(installEnv, specs as string[])
  return result.ok ? { ok: true, data: { installed: specs, note: '重启后生效' } } : result
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

void firstRun()
  .then(mountAll)
  .then(() => {
    console.error(`[host] up，dataDir=${dataDir}，挂上 ${mounted.filter((m) => m.ok).length}/${mounted.length}`)
    send({ t: 'ready' })
  })
