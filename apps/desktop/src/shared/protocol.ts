/**
 * 主进程 ↔ 宿主子进程的行协议：一行一条 JSON。
 * 命令下行走 stdin，宿主上行走 fd3。两头都从这里取形状与解析。
 */

/** 主进程 → 宿主 */
export interface CommandLine {
  t: 'command'
  id: string
  payload: { command: string; args?: unknown }
}

/** 日志是哪一路来的。四个字面量，闭集——窗格的路筛选靠它做多选 */
export type LogSource = 'plugin' | 'host' | 'main' | 'renderer'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * 一条日志，**发号之前**。宿主经 fd3 报上来的就是这个形状。
 * `msg` 是已经渲染好的字符串，不是 args——跨这条线的 JSON 因此一定序列化得动。
 */
export interface LogLine {
  ts: number
  source: LogSource
  level: LogLevel
  name: string
  msg: string
}

/**
 * 发号之后。窗格看到的、backlog 里的，永远是这一个。
 *
 * `seq` 由**主进程**发：四路混合之后才有全序，宿主那一路自己的序号只在它自己里有序。
 * 去重与排序都用它——拿 `ts` 拼字符串当键的话，同一毫秒里两句一模一样的话会被吃掉一句。
 */
export interface LogEntry extends LogLine {
  seq: number
}

/** 宿主 → 主进程 */
export type HostMessage =
  | { t: 'ready' }
  | { t: 'reply'; id: string; result: unknown }
  | { t: 'event'; payload: unknown }
  | { t: 'log'; line: LogLine }

function asObject(line: string): Record<string, unknown> | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
  return parsed as Record<string, unknown>
}

const SOURCES: readonly string[] = ['plugin', 'host', 'main', 'renderer']
const LEVELS: readonly string[] = ['error', 'warn', 'info', 'debug']

/**
 * 把外面来的级别名收窄成这四个之一。
 *
 * `warning` 那一条是 electron 的 `console-message` 用的词，其余同名。认不出的一律 `info`
 * ——**宁可级别钝一点，也不要让窗格上多出一个点不掉的挡位**。
 */
export function asLogLevel(raw: string): LogLevel {
  if (raw === 'warning') return 'warn'
  return LEVELS.includes(raw) ? (raw as LogLevel) : 'info'
}

const LEVEL_MARK: Record<LogLevel, string> = { error: 'E', warn: 'W', info: 'I', debug: 'D' }

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** `HH:mm:ss.SSS`。四路合流之后「谁先谁后」是最常问的问题，秒级分不开 */
function clock(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/**
 * 终端与日志文件里一行的样子。**四路共用这一处**——各写各的话，同一个文件里就是宿主那路
 * 带时间与级别、主进程那路只有个方括号前缀，两种格式混着读。
 *
 * 窗格不用它：那边有结构化字段，时间、级别、来源自己画。
 */
export function formatLogLine(line: LogLine): string {
  return `${clock(line.ts)} ${LEVEL_MARK[line.level]} ${line.name} ${line.msg}`
}

/**
 * 日志行的形状检查。`source` 与 `level` 只认那两张表里的字面量——**放宽成任意字符串的话，
 * 窗格的筛选器会多出几个谁也点不掉的挡位**，而那种脏值从哪来是查不回去的。
 */
function asLogLine(value: unknown): LogLine | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const { ts, source, level, name, msg } = value as Record<string, unknown>
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return undefined
  if (typeof source !== 'string' || !SOURCES.includes(source)) return undefined
  if (typeof level !== 'string' || !LEVELS.includes(level)) return undefined
  if (typeof name !== 'string' || typeof msg !== 'string') return undefined
  return { ts, source: source as LogSource, level: level as LogLevel, name, msg }
}

export function parseHostLine(line: string): HostMessage | undefined {
  const msg = asObject(line)
  if (msg === undefined) return undefined
  if (msg.t === 'ready') return { t: 'ready' }
  if (msg.t === 'event') return { t: 'event', payload: msg.payload }
  if (msg.t === 'reply' && typeof msg.id === 'string') return { t: 'reply', id: msg.id, result: msg.result }
  if (msg.t === 'log') {
    const parsed = asLogLine(msg.line)
    return parsed === undefined ? undefined : { t: 'log', line: parsed }
  }
  return undefined
}

export function parseCommandLine(line: string): CommandLine | undefined {
  const msg = asObject(line)
  if (msg === undefined || msg.t !== 'command' || typeof msg.id !== 'string') return undefined
  const payload = msg.payload
  if (payload === null || typeof payload !== 'object') return undefined
  const { command, args } = payload as { command?: unknown; args?: unknown }
  if (typeof command !== 'string') return undefined
  return { t: 'command', id: msg.id, payload: { command, args } }
}
