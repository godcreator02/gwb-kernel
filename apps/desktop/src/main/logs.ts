import { asLogLevel, formatLogLine, type LogEntry, type LogLevel, type LogLine } from '../shared/protocol'

/**
 * 四路日志的汇合点：发号、进环形缓冲、按批推给窗口。
 *
 * 四路是件与 loader 的 cordis 日志、宿主自己的话（这两路经 fd3 上来）、主进程自己的话、
 * 渲染层的 console。为什么汇在这儿、为什么存条目不存原始行，见文档站。
 */

/** 缓冲装多少条。够翻回开机那一段，又不至于占太多内存（一条约 200 字节） */
export const LOG_BUFFER_CAP = 2000

/** 攒多久推一批。逐条推的话，崩溃循环刷屏时光是 IPC 就能把渲染层压住 */
export const FLUSH_MS = 100

export interface LogHub {
  /** 收一条日志：发号、入缓冲、排进下一批 */
  push(line: LogLine): void
  /** 开机到此刻的全部条目（副本） */
  backlog(): LogEntry[]
  /** 往窗口推的那一手。窗口没了就设回 null */
  setSink(sink: ((batch: LogEntry[]) => void) | null): void
}

export function createLogHub(cap: number = LOG_BUFFER_CAP, flushMs: number = FLUSH_MS): LogHub {
  let seq = 0
  const buffer: LogEntry[] = []
  let sink: ((batch: LogEntry[]) => void) | null = null
  let pending: LogEntry[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = (): void => {
    timer = null
    const batch = pending
    pending = []
    if (batch.length > 0 && sink !== null) sink(batch)
  }

  return {
    push(line) {
      const entry: LogEntry = { ...line, seq: ++seq }
      // 先入缓冲、再排队推窗，而且**入缓冲这一步绝不看窗口在不在**——窗口就绪之前那些
      // （宿主起步、件挂不上）正是最该留住的。「一条不丢」全靠这两行的顺序。
      buffer.push(entry)
      if (buffer.length > cap) buffer.splice(0, buffer.length - cap)
      if (sink === null) return
      pending.push(entry)
      if (timer !== null) return
      timer = setTimeout(flush, flushMs)
      // 这个 100ms 的定时器不该拖住进程退出
      timer.unref?.()
    },
    backlog: () => [...buffer],
    setSink(next) {
      sink = next
      if (next === null) pending = []
    },
  }
}

/** 主进程全局那一份 */
const hub = createLogHub()

export const pushLog = (line: LogLine): void => hub.push(line)
export const logBacklog = (): LogEntry[] => hub.backlog()
export const setLogSink = (sink: ((batch: LogEntry[]) => void) | null): void => hub.setSink(sink)

/**
 * 一处两投：stderr（劫持之后顺带进文件）与缓冲（→ 窗格）。正文是同一个字符串。
 *
 * 投 stderr **不用 `console.error`**：日志出口将来可能要劫持 `console.*`，那时用 console
 * 投就是自食其尾的无限循环。现在写对，到期时零成本。
 */
function emit(line: LogLine): void {
  process.stderr.write(formatLogLine(line) + '\n')
  pushLog(line)
}

/** 主进程自己说一句话 */
export function mainLog(level: LogLevel, name: string, msg: string): void {
  emit({ ts: Date.now(), source: 'main', level, name, msg })
}

/**
 * 渲染层那一路。`rawLevel` 收 electron `console-message` 给的那几个词。
 *
 * **页面上的日志窗格自己别在收条目的路径上打 console**：打一句就绕回这儿、再推回页面，
 * 一变二、二变四，界面当场冻死。
 */
export function rendererLog(rawLevel: string, msg: string): void {
  emit({ ts: Date.now(), source: 'renderer', level: asLogLevel(rawLevel), name: 'renderer', msg })
}
