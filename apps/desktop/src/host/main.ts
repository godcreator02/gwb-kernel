import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import { parseCommandLine, type HostMessage } from '../shared/protocol'
import { parseEntries, resolvePlugin, type Entry } from './entries'

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

/** 挂载结果:每条一句话，说得出为什么没挂上 */
interface Mounted {
  id: string
  ok: boolean
  why?: string
}

const mounted: Mounted[] = []

async function mountEntry(entry: Entry): Promise<Mounted> {
  if (entry.disabled === true) return { id: entry.id, ok: false, why: '条目被禁用' }
  const file = resolvePlugin(entry.name, siteDir)
  if (file === undefined) return { id: entry.id, ok: false, why: `位里没有 ${entry.name}（或入口文件不在）` }
  try {
    const mod: unknown = await import(pathToFileURL(file).href)
    ctx.plugin(mod as never, entry.config ?? {})
    return { id: entry.id, ok: true }
  } catch (err) {
    // 一个坏件不拖垮别的:记下原因，接着挂下一条
    return { id: entry.id, ok: false, why: String(err) }
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

async function dispatch(payload: { command: string; args?: unknown }): Promise<unknown> {
  if (payload.command === 'kernel.info') return kernelInfo()
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

void mountAll().then(() => {
  console.error(`[host] up，dataDir=${dataDir}，挂上 ${mounted.filter((m) => m.ok).length}/${mounted.length}`)
  send({ t: 'ready' })
})
