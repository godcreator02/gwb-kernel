import fs from 'node:fs'
import path from 'node:path'

/**
 * 把终端上那条流同时落到文件。三处输出——主进程自己、宿主 pipe 过来的、渲染层
 * console 转来的——最后都汇在 process.stderr 上,劫持这一处就全在里头了。
 *
 * 这不是「日志功能」:不分级、不缓冲、不进界面、不轮转。它只保证一件事——脱离终端
 * 起的时候（打包后双击,stderr 没人接),出了事还有个地方查得到。
 */
export function teeToFile(file: string): void {
  let fd: number
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fd = fs.openSync(file, 'a')
  } catch (err) {
    console.error(`[log] 日志文件开不了,此后只走 stderr:${String(err)}`)
    return
  }

  // 一次启动一段:文件是 append 的,没有这条线就分不清哪几行是这次跑出来的
  fs.writeSync(fd, Buffer.from(`\n=== 启动 ${new Date().toISOString()} ===\n`))

  // 写失败只说一次、此后不再试:静默停更会让人读到一段什么都没发生的时间,
  // 每行重试则把每行输出变成一次失败的系统调用
  let dead = false
  for (const stream of [process.stdout, process.stderr]) {
    const orig = stream.write.bind(stream) as (chunk: string | Uint8Array, ...rest: unknown[]) => boolean
    stream.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      if (!dead) {
        try {
          fs.writeSync(fd, chunk instanceof Uint8Array ? Buffer.from(chunk) : Buffer.from(String(chunk)))
        } catch (err) {
          dead = true
          orig(`[log] 日志写不进去了,此后只走 stderr:${String(err)}\n`)
        }
      }
      return orig(chunk, ...rest)
    }) as typeof stream.write
  }
}
