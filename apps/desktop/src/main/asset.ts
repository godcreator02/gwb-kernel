import fs from 'node:fs'
import { parseAssetUrl } from '../shared/asset-url'
import { resolvePlugin } from '../shared/entries'

/** gwb:// 的执行端:URL 认出要哪个包,位查找问出文件在哪,读出来交给页面。判断在两个纯函数里,这里只剩读盘 */

function notFound(): Response {
  return new Response(null, { status: 404 })
}

export async function handleAsset(siteDir: string, request: Request): Promise<Response> {
  const parsed = parseAssetUrl(new URL(request.url))
  if (parsed === undefined) return notFound()
  const file = resolvePlugin(parsed.pkg, siteDir, './client')
  if (file === undefined) return notFound()
  let body: Uint8Array<ArrayBuffer>
  try {
    const raw = await fs.promises.readFile(file)
    // Response 的 body 只收 ArrayBufferView<ArrayBuffer>,Buffer 挂的是 ArrayBufferLike——拷进一条自持缓冲
    body = new Uint8Array(raw.byteLength)
    body.set(raw)
  } catch {
    return notFound()
  }
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
      // 页面在 file:// 或 dev 的 http://,跟 gwb:// 都跨源
      'access-control-allow-origin': '*',
    },
  })
}
