/** `gwb.log` 里的一条：键与顺序是日志接缝的契约，见文档站 */
export interface LogRecord {
  ts: string
  level: LogLevel
  source: LogSource
  name: string
  msg: string
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'
export type LogSource = 'kernel' | 'plugin' | 'renderer'

/** 内核自己用的名字与 cordis 的 loader、include 用的名字 */
const KERNEL_LOGGER_NAMES = new Set(['kernel', 'loader', 'include'])
/** 页面 console 转成日志时用的名字 */
export const RENDERER_LOGGER_NAME = 'renderer'

export function levelOf(cordisType: string): LogLevel {
  if (cordisType === 'error' || cordisType === 'warn' || cordisType === 'debug') return cordisType
  return 'info'
}

export function sourceOfLoggerName(loggerName: string): LogSource {
  if (loggerName === RENDERER_LOGGER_NAME) return 'renderer'
  return KERNEL_LOGGER_NAMES.has(loggerName) ? 'kernel' : 'plugin'
}

export function fileLineOf(record: LogRecord): string {
  const { ts, level, source, name, msg } = record
  return `${JSON.stringify({ ts, level, source, name, msg })}\n`
}

export function terminalLineOf(record: LogRecord): string {
  return `${record.ts} ${record.level} ${record.name} ${record.msg}\n`
}

/**
 * cordis 格式化 Error 用的是 stack；loader 在 import 失败时把 stack 换成只剩条目路径，原文只留在 message 里。
 * 正文里找不到哪个 Error 的 message，就把「名字: message」补在最前面
 */
export function withLostErrorMessages(formatted: string, args: readonly unknown[]): string {
  const lostMessages = args
    .filter((arg): arg is Error => arg instanceof Error && !formatted.includes(arg.message))
    .map((error) => `${error.name}: ${error.message}`)
  return lostMessages.length === 0 ? formatted : [...lostMessages, formatted].join('\n')
}
