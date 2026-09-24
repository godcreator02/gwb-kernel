import fs from 'node:fs'

/** 一份日志的默认上限，取值依据见文档站 */
export const DEFAULT_LIMIT_BYTES = 128 * 1024 * 1024

/** 默认留一份旧的：磁盘占用不超过两个上限 */
export const DEFAULT_KEEP = 1

const REOPEN_RETRY_INTERVAL_MS = 60_000

/** `GWB_LOG_LIMIT_MB` 换算成字节；没给、空的、不是非负整数时用 `fallback` */
export function limitFromEnv(raw: string | undefined, fallback = DEFAULT_LIMIT_BYTES): number {
  if (raw === undefined) return fallback
  const trimmed = raw.trim()
  if (trimmed === '') return fallback
  const megabytes = Number(trimmed)
  if (!Number.isInteger(megabytes) || megabytes < 0) return fallback
  return megabytes * 1024 * 1024
}

export interface LogFileOptions {
  /** 正在写的那份（`<home>/gwb.log`），轮转后路径不变 */
  file: string
  /** 上限字节数；0 表示不轮转 */
  limitBytes: number
  /** 留几份旧的（`.1` … `.n`）；0 表示轮转时直接删掉 */
  keep?: number
  /** 文件打不开、轮转失败、写不进时各告警一句；它自己抛出的异常被吞掉 */
  onWarn?: (message: string) => void
}

export interface LogFile {
  readonly file: string
  /** 不抛：写不进时这一段只丢掉，告警一句 */
  write(chunk: string): void
  /** 给测试与显式清理用；进程退出时句柄本来也会被回收 */
  close(): void
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** 永不抛：写日志出问题不能反过来让内核崩溃，每一处文件操作都自己处理错误 */
export function openLogFile(options: LogFileOptions): LogFile {
  const { file, limitBytes, onWarn } = options
  const rotatedCopiesToKeep = Math.max(0, Math.trunc(options.keep ?? DEFAULT_KEEP))

  let fileDescriptor: number | null = null
  let bytesInCurrentFile = 0
  let rotateWhenBytesReach = limitBytes
  let lastOpenAttemptAt = 0
  let writeFailureAlreadyWarned = false

  const warnWithoutThrowing = (message: string): void => {
    try {
      onWarn?.(message)
    } catch {
      // 告警本身失败也不能抛出去
    }
  }

  function currentFileSizeOrZero(): number {
    try {
      return fs.statSync(file).size
    } catch {
      // 文件刚由 openSync 建出，stat 失败按 0 算，不因此停写日志
      return 0
    }
  }

  function openCurrentFile(): void {
    lastOpenAttemptAt = Date.now()
    try {
      fileDescriptor = fs.openSync(file, 'a')
      bytesInCurrentFile = currentFileSizeOrZero()
      rotateWhenBytesReach = limitBytes
    } catch (err) {
      fileDescriptor = null
      warnWithoutThrowing(`日志文件打不开（${file}）：${reasonOf(err)}；重新打开之前日志只写 stderr`)
    }
  }

  function closeCurrentFile(): void {
    if (fileDescriptor === null) return
    const closingDescriptor = fileDescriptor
    fileDescriptor = null
    try {
      fs.closeSync(closingDescriptor)
    } catch {
      // 关不掉的句柄没有补救办法，也不该拦住之后的改名
    }
  }

  /** `gwb.log` → `.1` → `.2` …，超出保留份数的删掉；不留旧份时直接删掉当前这份。改名前先删目标：Windows 上改名不一定覆盖已有文件 */
  function shiftRotatedCopies(): void {
    if (rotatedCopiesToKeep === 0) {
      fs.rmSync(file, { force: true })
      return
    }
    fs.rmSync(`${file}.${rotatedCopiesToKeep}`, { force: true })
    for (let copyNumber = rotatedCopiesToKeep - 1; copyNumber >= 1; copyNumber--) {
      if (fs.existsSync(`${file}.${copyNumber}`)) fs.renameSync(`${file}.${copyNumber}`, `${file}.${copyNumber + 1}`)
    }
    fs.renameSync(file, `${file}.1`)
  }

  /** 先关句柄再改名：Windows 上开着句柄改名不保证成功，成功了句柄也还指着改名后的旧文件 */
  function rotate(): void {
    closeCurrentFile()
    try {
      shiftRotatedCopies()
      openCurrentFile()
    } catch (err) {
      warnWithoutThrowing(`日志轮转失败（${file}）：${reasonOf(err)}；继续写原来的文件，再写满一个上限后重试`)
      openCurrentFile()
      rotateWhenBytesReach = bytesInCurrentFile + limitBytes
    }
  }

  function reopenIfRetryIsDue(): void {
    if (fileDescriptor === null && Date.now() - lastOpenAttemptAt >= REOPEN_RETRY_INTERVAL_MS) openCurrentFile()
  }

  function rotateIfLimitReached(): void {
    if (limitBytes > 0 && fileDescriptor !== null && bytesInCurrentFile >= rotateWhenBytesReach) rotate()
  }

  function appendOrWarnOnce(descriptor: number, chunk: string): void {
    try {
      bytesInCurrentFile += fs.writeSync(descriptor, Buffer.from(chunk, 'utf8'))
      writeFailureAlreadyWarned = false
    } catch (err) {
      if (!writeFailureAlreadyWarned) {
        writeFailureAlreadyWarned = true
        warnWithoutThrowing(`写日志文件失败（${file}）：${reasonOf(err)}；恢复之前日志只写 stderr`)
      }
    }
  }

  function write(chunk: string): void {
    reopenIfRetryIsDue()
    rotateIfLimitReached()
    if (fileDescriptor === null) return
    appendOrWarnOnce(fileDescriptor, chunk)
  }

  openCurrentFile()
  return {
    file,
    write,
    close: closeCurrentFile,
  }
}
