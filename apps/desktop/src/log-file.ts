import fs from 'node:fs'

/** `gwb.log` 的上限，取值依据见文档站 */
export const LOG_LIMIT_BYTES = 128 * 1024 * 1024

const REOPEN_RETRY_INTERVAL_MS = 60_000

export interface LogFileOptions {
  /** 正在写的那份（`<home>/gwb.log`），轮转后路径不变；只留一份旧的 `<file>.1` */
  file: string
  limitBytes: number
  /** 文件打不开、轮转失败、写不进时各告警一句；它自己抛出的异常被吞掉 */
  onWarn: (message: string) => void
}

export interface LogFile {
  /** 不抛：写不进时这一段只丢掉，告警一句 */
  write(chunk: string): void
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** 永不抛：写日志出问题不能反过来让内核崩溃，每一处文件操作都自己处理错误 */
export function openLogFile(options: LogFileOptions): LogFile {
  const { file, limitBytes, onWarn } = options
  const rotatedCopy = `${file}.1`

  let fileDescriptor: number | null = null
  let bytesInCurrentFile = 0
  let rotateWhenBytesReach = limitBytes
  let lastOpenAttemptAt = 0
  let writeFailureAlreadyWarned = false

  const warnWithoutThrowing = (message: string): void => {
    try {
      onWarn(message)
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

  /** 改名前先删目标：Windows 上改名不一定覆盖已有文件 */
  function replaceRotatedCopyWithCurrentFile(): void {
    fs.rmSync(rotatedCopy, { force: true })
    fs.renameSync(file, rotatedCopy)
  }

  /** 先关句柄再改名：Windows 上开着句柄改名不保证成功，成功了句柄也还指着改名后的旧文件 */
  function rotate(): void {
    closeCurrentFile()
    try {
      replaceRotatedCopyWithCurrentFile()
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
    if (fileDescriptor !== null && bytesInCurrentFile >= rotateWhenBytesReach) rotate()
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
  return { write }
}
