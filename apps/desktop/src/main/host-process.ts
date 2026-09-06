import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseHostLine } from '../shared/protocol'

/**
 * 起宿主子进程、守住那条命令通道。
 * 拉起要 --expose-internals（cordis loader 用得上），而主进程的 NODE_OPTIONS
 * 白名单拒它，所以只能走 ELECTRON_RUN_AS_NODE 把 electron 当 node 使。
 */

const here = path.dirname(fileURLToPath(import.meta.url))

export interface Host {
  proc: ChildProcess
  pending: Map<string, (result: unknown) => void>
}

export interface HostEnv {
  dataDir: string
  version: string
  onEvent: (payload: unknown) => void
}

/** 在飞的命令等多久算超时。宿主卡死时不给上限，界面会永远转圈 */
const COMMAND_TIMEOUT = 120_000

export function startHost(env: HostEnv): Promise<Host> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['--expose-internals', path.join(here, 'host.mjs')], {
      cwd: path.resolve(here, '../..'),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        GWB_DATA_DIR: env.dataDir,
        GWB_VERSION: env.version,
      },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const host: Host = { proc, pending: new Map() }

    proc.stdout!.pipe(process.stdout)
    proc.stderr!.pipe(process.stderr)

    proc.on('exit', (code) => {
      console.error(`[gwb] 宿主退出（code=${code}）`)
      // 在飞的命令不能永远悬着——立刻给失败回执
      for (const done of host.pending.values()) done({ ok: false, error: '宿主已退出' })
      host.pending.clear()
      reject(new Error(`宿主退出（code=${code}）`))
    })

    readline.createInterface({ input: proc.stdio[3] as NodeJS.ReadableStream }).on('line', (line) => {
      if (!line.trim()) return
      const msg = parseHostLine(line)
      if (msg === undefined) {
        console.error(`[gwb] 宿主发来不合协议的行，已丢弃：${line.slice(0, 200)}`)
        return
      }
      if (msg.t === 'ready') resolve(host)
      else if (msg.t === 'event') env.onEvent(msg.payload)
      else host.pending.get(msg.id)?.(msg.result)
    })
  })
}

export function hostCommand(host: Host, payload: { command: string; args?: unknown }): Promise<unknown> {
  if (host.proc.killed) return Promise.resolve({ ok: false, error: '宿主没在跑' })
  const id = randomUUID()
  return new Promise((resolve) => {
    const done = (result: unknown): void => {
      if (host.pending.delete(id)) resolve(result)
    }
    host.pending.set(id, done)
    host.proc.stdin!.write(JSON.stringify({ t: 'command', id, payload }) + '\n')
    setTimeout(() => done({ ok: false, error: '命令超时' }), COMMAND_TIMEOUT)
  })
}

export function killHost(host: Host): void {
  host.proc.kill()
}
