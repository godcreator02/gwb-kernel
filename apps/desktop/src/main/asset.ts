import fs from 'node:fs'
import path from 'node:path'
import { parseAssetUrl } from '../shared/asset-url'
import { resolvePlugin } from '../shared/entries'
import { mainLog } from './logs'

/** gwb:// 的执行端：认出要哪个包的哪个子路径、查出文件在哪、读出来交给页面。判断在两个纯函数里，这里只剩读盘 */

/**
 * 扩展名 → content-type，认不出的不交。
 * 按解析出的**真实文件**判，不按 URL——exports 的 `./client` 落到的是 `dist/client.js`。
 * 样式表这条不能少：Chromium 对 `<link rel=stylesheet>` 严查 MIME，不是 text/css 就拒。
 */
const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function notFound(why: string): Response {
  // 过去这条线全程静默:取件失败在四路日志里一个字都没有,症状只有页面上白一块
  mainLog('warn', 'asset', why)
  return new Response(null, { status: 404 })
}

export async function handleAsset(siteDir: string, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const parsed = parseAssetUrl(url)
  if (parsed === undefined) return notFound(`认不出 ${url.pathname}，拒了`)
  const file = resolvePlugin(parsed.pkg, siteDir, parsed.sub)
  if (file === undefined) return notFound(`${parsed.pkg} 的 ${parsed.sub} 落不了地：包没装，或路径出了包目录`)
  const type = TYPES[path.extname(file).toLowerCase()]
  if (type === undefined) return notFound(`${file} 的扩展名不在认得的那几种里`)
  let body: Uint8Array<ArrayBuffer>
  try {
    const raw = await fs.promises.readFile(file)
    // Response 的 body 只收 ArrayBufferView<ArrayBuffer>，Buffer 挂的是 ArrayBufferLike
    body = new Uint8Array(raw.byteLength)
    body.set(raw)
  } catch (err: unknown) {
    return notFound(`${file} 读不动：${String(err)}`)
  }
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': type,
      'cache-control': 'no-store',
      // 页面跟 gwb:// 跨源
      'access-control-allow-origin': '*',
    },
  })
}
