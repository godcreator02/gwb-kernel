import fs from 'node:fs'

/** 0.10 之前的内核把 `gwb.log` 写成文本行；改名时加在原文件名后面 */
const TEXT_LOG_SUFFIX = '.text'

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

function startsAsTextLog(file: string): boolean {
  let descriptor: number
  try {
    descriptor = fs.openSync(file, 'r')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw new Error(`日志文件打不开（${file}）：${reasonOf(err)}`, { cause: err })
  }
  try {
    const firstByte = Buffer.alloc(1)
    const bytesRead = fs.readSync(descriptor, firstByte, 0, 1, 0)
    return bytesRead === 1 && firstByte.toString('utf8') !== '{'
  } finally {
    fs.closeSync(descriptor)
  }
}

/**
 * 旧内核留下的文本格式 `gwb.log` 与 `gwb.log.1` 改名成 `.text` 留给人看，读日志的一方只会见到一行一个 JSON 的文件。
 * 回改了名的文件；读不了、改名失败都抛，错误信息写明文件与原因，由调用方按日志文件用不了处理
 */
export function setAsideTextLogs(logFile: string): string[] {
  const movedTo: string[] = []
  for (const file of [logFile, `${logFile}.1`]) {
    if (!startsAsTextLog(file)) continue
    const target = file + TEXT_LOG_SUFFIX
    try {
      // Windows 上改名不一定覆盖已有文件
      fs.rmSync(target, { force: true })
      fs.renameSync(file, target)
    } catch (err) {
      throw new Error(`旧内核写的文本日志改名失败（${file} → ${target}）：${reasonOf(err)}`, { cause: err })
    }
    movedTo.push(target)
  }
  return movedTo
}
