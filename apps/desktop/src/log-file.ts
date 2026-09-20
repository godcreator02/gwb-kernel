import fs from 'node:fs'

/**
 * 内核日志文件的**上限与轮转**：`gwb.log` 长到上限就滚一份带序号的旧文件，只留最近几份。
 * 上限取多大、为什么这么滚，判据写在 main.ts 的日志出口那段；这儿只管机械。
 *
 * 与 main.ts 分开是为了能单测：这边不碰 electron、不碰 cordis，进来一个路径与上限，出去一个
 * write()。**fs 走真的**，测试拿临时目录跑——失败那条（滚不动）用「目标格子被目录占着」造，
 * 那是 Windows 上真会撞的形态，比打桩可信。
 */

/** 一份日志的上限默认值。判据见 main.ts 日志出口那段 */
export const DEFAULT_LIMIT_BYTES = 128 * 1024 * 1024

/** 留几份旧的：一份现行加一份旧的，磁盘总共压在两个上限以内 */
export const DEFAULT_KEEP = 1

/**
 * 开不出文件之后，隔多久允许再试一次。**不是每条日志都试**——那是每条一次系统调用；一次比较
 * 换一次恢复的机会，一分钟够快也够便宜
 */
const RETRY_OPEN_MS = 60_000

/**
 * 上限从 `GWB_LOG_LIMIT_MB` 读，单位 MB。读不出数（没给、空的、不是整数、负数）就用默认值：
 * 上限是防写爆的兜底，一个打错的配置项不该把内核赔进去。**0 是唯一的例外**——那是有意要
 * 「不轮转、留全量」的人写的，照给。
 */
export function limitFromEnv(raw: string | undefined, fallback = DEFAULT_LIMIT_BYTES): number {
  if (raw === undefined) return fallback
  const text = raw.trim()
  if (text === '') return fallback
  const mb = Number(text)
  if (!Number.isInteger(mb) || mb < 0) return fallback
  return mb * 1024 * 1024
}

export interface LogFileOptions {
  /** 活动文件的路径（`<home>/gwb.log`）。轮转不改它，改的是它此刻装着哪一段 */
  file: string
  /** 上限字节数；0 = 不轮转 */
  limitBytes: number
  /** 留几份旧的（`.1` … `.n`）；0 = 滚掉的那份直接删 */
  keep?: number
  /** 出岔子时说一句（文件开不出来、轮转没成、写不进去）。它自己也不该把内核带走 */
  onWarn?: (message: string) => void
}

export interface LogFile {
  readonly file: string
  /** 写一段。**不抛**：盘满、被占、没权限都只让这一段进不了文件，落一条 warn 了事 */
  write(chunk: string): void
  /** 关掉当前句柄。进程退出时 fd 本来也会被收走，这条是给测试与显式收尾用的 */
  close(): void
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * 开一份带上限与轮转的日志文件。**永不抛**：这个通道的存在意义是「内核出错时人看得见」，
 * 它自己出岔子绝不能反过来把内核带走，所以每一处系统调用都收着自己的错。
 */
export function openLogFile(options: LogFileOptions): LogFile {
  const { file, limitBytes, onWarn } = options
  const keep = Math.max(0, Math.trunc(options.keep ?? DEFAULT_KEEP))

  let fd: number | null = null
  /** 当前这份已写多少字节：开文件时量一次，之后按写进去的字节累加——**不每条 stat** */
  let bytes = 0
  /** 到了这条线就滚。轮转失败时把它推到「再长一整个上限」之后：失败一次说一句，不每条都撞墙 */
  let rotateAt = limitBytes
  /** 上一次试着开文件的时刻，给 fd === null 时的重试用 */
  let openedAt = 0
  /** 写失败只喊一次，写成了再把嘴张开——不然盘满时每条日志喊两遍 */
  let writeWarned = false

  const warn = (message: string): void => {
    try {
      onWarn?.(message)
    } catch {
      // 说一句都失败就没别的可做了，也绝不能因此抛出去
    }
  }
  function sizeOf(): number {
    try {
      return fs.statSync(file).size
    } catch {
      // 量不出来就当 0：openSync 刚把它建出来过，stat 再失败也不该拦住日志
      return 0
    }
  }

  /**
   * 开一条能写的 fd，并把「当前这份有多少字节」重新量一遍。**只在开局与每次轮转后各调一次**
   * ——每条日志 stat 一次就是每条一次系统调用，这台机器一天几十万条，不值。
   */
  function open(): void {
    openedAt = Date.now()
    try {
      fd = fs.openSync(file, 'a')
      bytes = sizeOf()
      // 上一轮内核留下的那份可能已经远超上限（2026-09-20 实测那份 6.67 GB）：下一条日志就滚
      rotateAt = limitBytes
    } catch (err) {
      fd = null
      warn(`日志文件开不出来（${file}）：${reasonOf(err)}；这段只往 stderr 写`)
    }
  }

  function close(): void {
    if (fd === null) return
    const dying = fd
    fd = null
    try {
      fs.closeSync(dying)
    } catch {
      // 关不掉的句柄没有补救动作，它也不该拦住下面的改名
    }
  }

  /**
   * 滚一份：`gwb.log` → `gwb.log.1`，更老的顺次往后挪，越过 keep 的删掉；keep=0 就是删掉现行那份。
   *
   * 顺序上有两处是 Windows 逼出来的：**先关句柄再改名**（占着句柄改名不保证成功，而且就算成了，
   * 手里那条 fd 也悬在已被改名的文件上，后面的日志会写进旧的那份），**挪之前先把终点那格删掉**
   * （改名撞上已存在的目标不一定肯覆盖）。滚到一半出岔子也不能留在「没有 fd」的状态里——catch
   * 完照样 open：原来那份还在原地，写继续，只是这次没滚成。
   */
  function rotate(): void {
    close()
    try {
      if (keep === 0) {
        fs.rmSync(file, { force: true })
      } else {
        fs.rmSync(`${file}.${keep}`, { force: true })
        for (let i = keep - 1; i >= 1; i--) {
          if (fs.existsSync(`${file}.${i}`)) fs.renameSync(`${file}.${i}`, `${file}.${i + 1}`)
        }
        fs.renameSync(file, `${file}.1`)
      }
      open()
    } catch (err) {
      warn(`日志轮转没成（${file}）：${reasonOf(err)}；继续往后写，再长一个上限才重试`)
      open()
      rotateAt = bytes + limitBytes
    }
  }

  function write(chunk: string): void {
    if (fd === null && Date.now() - openedAt >= RETRY_OPEN_MS) open()
    if (limitBytes > 0 && fd !== null && bytes >= rotateAt) rotate()
    const target = fd
    if (target === null) return
    const line = Buffer.from(chunk, 'utf8')
    try {
      bytes += fs.writeSync(target, line)
      writeWarned = false
    } catch (err) {
      if (!writeWarned) {
        writeWarned = true
        warn(`日志写不进 ${file}：${reasonOf(err)}；这段只往 stderr 写`)
      }
    }
  }

  open()
  return {
    file,
    write,
    close,
  }
}
