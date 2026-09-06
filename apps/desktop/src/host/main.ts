import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { Context } from 'cordis'
import { parseCommandLine, type HostMessage } from '../shared/protocol'

/**
 * 宿主子进程入口（纯 node，由主进程以 ELECTRON_RUN_AS_NODE 拉起）。
 * 第一刀只做「载体」那一半：起 cordis，通上行协议，回一条自省命令。
 * 取址（读 yml 挂插件）是第二刀，这里还没有。
 */

// cordis 的 logger 走 console.log——先改道 stderr，别污染 fd1
console.log = console.error

const dataDir = process.env.GWB_DATA_DIR ?? path.resolve(process.cwd(), 'gwb-home')
const appVersion = process.env.GWB_VERSION ?? null

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

/** 内核自省口。除它之外一律走 ctx.cli——本体不认识任何插件的命令名 */
function kernelInfo(): unknown {
  return {
    ok: true,
    data: { pid: process.pid, node: process.versions.node, dataDir, appVersion, cordis: true },
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

console.error(`[host] up，dataDir=${dataDir}`)
send({ t: 'ready' })
