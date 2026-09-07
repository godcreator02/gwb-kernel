import fs from 'node:fs'
import path from 'node:path'
import { mainLog } from './logs'

/**
 * 把终端那条流同时落到文件。三处输出（主进程自己、宿主 pipe 过来的、渲染层 console
 * 转来的）都汇在 process.stderr 上，劫持这一处就全在。
 *
 * 它兜的是**一切写进 stderr 的字节**，含第三方库直写与未捕获异常——那些不走结构化那条路，
 * 窗格里看不到。两条流不是包含关系，取舍见文档站。
 *
 * 不分级、不缓冲、不进界面。写满就切一段。
 */

/** 现役那份的名字。**固定不变**——`tail -f`、编辑器、将来读它的代码都盯得住一个不变的名字 */
const CURRENT = 'gwb.log'

/** 写满多少切一段。按字节不按行数：行长差异太大，而且长度是白得的、数换行要多扫一遍 */
const MAX_BYTES = 2 * 1024 * 1024

/** 归档留几份，超出的删最旧 */
export const KEEP = 20

/** 归档名。序号在扩展名之前是为了 Windows 上双击打得开 */
const ARCHIVE = /^gwb-\d{12}(-\d+)?\.log$/

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function stamp(d: Date): string {
  return (
    `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

/** 同一秒里切两段是可能的（崩溃循环），撞了就往后加号——直接 rename 会静默盖掉一整段 */
export function archiveName(dir: string, now: Date): string {
  const base = `gwb-${stamp(now)}`
  let name = `${base}.log`
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${base}-${n}.log`
  return name
}

/** 时刻命名的好处：字典序就是时间序，不用 stat 每个文件的 mtime */
export function pruneArchives(dir: string, keep: number = KEEP): void {
  const names = fs.readdirSync(dir).filter((n) => ARCHIVE.test(n)).sort()
  for (const name of names.slice(0, Math.max(0, names.length - keep))) {
    fs.rmSync(path.join(dir, name), { force: true })
  }
}

/**
 * 切一段。**无论切成没切成都交回一个开着的 fd**——切失败就丢下一个关掉的 fd 的话，
 * 下一次写会 `EBADF`，那会把「一次 rename 撞占用」放大成「此后再也不落盘」。
 */
export function rotate(dir: string, fd: number): { fd: number; ok: boolean } {
  const current = path.join(dir, CURRENT)
  fs.closeSync(fd)
  let ok = true
  try {
    // Windows 上 rename 一个自己正开着的文件会 EPERM，所以先关。别的进程开着它也会抛
    fs.renameSync(current, path.join(dir, archiveName(dir, new Date())))
  } catch {
    ok = false
  }
  // 删不掉旧的不算切失败——那一段已经归档了
  if (ok) {
    try {
      pruneArchives(dir)
    } catch {
      /* 留着就留着 */
    }
  }
  return { fd: fs.openSync(current, 'a'), ok }
}

export function teeToFile(dir: string): void {
  const current = path.join(dir, CURRENT)
  let fd: number
  let written: number
  try {
    fs.mkdirSync(dir, { recursive: true })
    fd = fs.openSync(current, 'a')
    // 唯一一次 stat：接着上次那份写。此后靠记账，不再问文件系统
    written = fs.statSync(current).size
  } catch (err) {
    mainLog('error', 'log', `日志文件开不了,此后只走 stderr:${String(err)}`)
    return
  }

  // 一份里可能跨好几次启动，没有这条认不出边界
  const header = Buffer.from(`\n=== 启动 ${new Date().toISOString()} ===\n`)
  fs.writeSync(fd, header)
  written += header.length

  /** 写失败：此后不再写。每行重试会把每行输出变成一次失败的系统调用 */
  let dead = false
  /**
   * 切失败：**不再切，但照常写**。上面那条理由在轮转上不成立——共用一个 latch 的话，
   * 一次被占用的 rename 就会掐死整条落盘线。两件事分开记。
   */
  let rotateDead = false

  for (const stream of [process.stdout, process.stderr]) {
    const orig = stream.write.bind(stream) as (chunk: string | Uint8Array, ...rest: unknown[]) => boolean
    stream.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      if (!dead) {
        const buf = chunk instanceof Uint8Array ? Buffer.from(chunk) : Buffer.from(String(chunk))
        try {
          if (!rotateDead && written + buf.length > MAX_BYTES) {
            const next = rotate(dir, fd)
            fd = next.fd
            if (next.ok) written = 0
            else {
              rotateDead = true
              orig(`[log] 日志切不动了,此后只往一个文件写\n`)
            }
          }
          fs.writeSync(fd, buf)
          written += buf.length
        } catch (err) {
          dead = true
          orig(`[log] 日志写不进去了,此后只走 stderr:${String(err)}\n`)
        }
      }
      return orig(chunk, ...rest)
    }) as typeof stream.write
  }
}
