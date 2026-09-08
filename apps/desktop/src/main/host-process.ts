import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseHostLine } from '../shared/protocol'
import { mainLog, pushLog } from './logs'

/**
 * 起宿主子进程、守住那条命令通道。
 * 拉起走 ELECTRON_RUN_AS_NODE + --expose-internals。取舍见文档站。
 */

const here = path.dirname(fileURLToPath(import.meta.url))

export interface Host {
  proc: ChildProcess
  pending: Map<string, (result: unknown) => void>
}

export interface HostEnv {
  dataDir: string
  /** 日志目录。宿主自己不写日志文件，它只是把这个路径经 `kernel.info` 转交给件 */
  logDir: string
  version: string
  onEvent: (payload: unknown) => void
  /** 宿主退出时给渲染层捎信。窗口里那页还当一切正常，得有人告诉它 */
  onHostExit: (code: number | null) => void
}

/** 在飞的命令的超时上限 */
const COMMAND_TIMEOUT = 120_000

export function startHost(env: HostEnv): Promise<Host> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['--expose-internals', path.join(here, 'host.mjs')], {
      cwd: path.resolve(here, '../..'),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        GWB_DATA_DIR: env.dataDir,
        GWB_LOG_DIR: env.logDir,
        GWB_VERSION: env.version,
      },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const host: Host = { proc, pending: new Map() }

    proc.stdout!.pipe(process.stdout)
    proc.stderr!.pipe(process.stderr)

    proc.on('exit', (code) => {
      // 这句只有主进程说得出来——宿主已经没了，它自己记不到自己的死
      mainLog('error', 'gwb', `宿主退出（code=${code}）`)
      // 在飞的命令立刻给失败回执
      for (const done of host.pending.values()) done({ ok: false, error: '宿主已退出' })
      host.pending.clear()
      // 渲染层那头没有管道可看，讣告得捎到——它好把整页换成崩溃页
      env.onHostExit(code)
      reject(new Error(`宿主退出（code=${code}）`))
    })

    readline.createInterface({ input: proc.stdio[3] as NodeJS.ReadableStream }).on('line', (line) => {
      if (!line.trim()) return
      const msg = parseHostLine(line)
      if (msg === undefined) {
        mainLog('warn', 'gwb', `宿主发来不合协议的行，已丢弃：${line.slice(0, 200)}`)
        return
      }
      if (msg.t === 'ready') resolve(host)
      else if (msg.t === 'event') env.onEvent(msg.payload)
      else if (msg.t === 'log') pushLog(msg.line)
      else host.pending.get(msg.id)?.(msg.result)
    })
  })
}

export function hostCommand(host: Host, payload: { command: string; args?: unknown }): Promise<unknown> {
  if (host.proc.killed) {
    mainLog('warn', 'gwb', `命令 ${payload.command} 没送出去：宿主进程已经杀了`)
    return Promise.resolve({ ok: false, error: '宿主没在跑' })
  }
  const id = randomUUID()
  return new Promise((resolve) => {
    // 只结算一次：先到的把计时器撤掉。不然每条成功回执的命令 120 秒后都会补报一条
    // 假「超时」——回执明明收到了、用了，日志却说按失败收
    let settled = false
    const settle = (result: unknown): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      host.pending.delete(id)
      resolve(result)
    }
    const timer = setTimeout(() => {
      if (settled) return
      // 回执只是收尾,日志先说一句:超时的命令过去只在调用方那里落一句「命令超时」,
      // 日志里对不上是哪条、卡了多久
      mainLog('warn', 'gwb', `命令 ${payload.command} 超时（${COMMAND_TIMEOUT}ms 没回），回执按失败收`)
      settle({ ok: false, error: '命令超时' })
    }, COMMAND_TIMEOUT)
    host.pending.set(id, settle)
    host.proc.stdin!.write(JSON.stringify({ t: 'command', id, payload }) + '\n')
  })
}

export function killHost(host: Host): void {
  mainLog('info', 'gwb', '退出，关宿主')
  host.proc.kill()
}
