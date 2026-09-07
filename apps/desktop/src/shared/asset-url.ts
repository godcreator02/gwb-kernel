/**
 * 桥的取货通道，约定就一条 URL：`gwb://asset/plugins/<包名>/client.js`。
 * 包名带 scope 是两段，所以「最后一段是资源名、前面全是包名」。
 */

const HOST = 'asset'
const PREFIX = '/plugins/'
/** 目前只交出这一样 */
const CLIENT = 'client.js'

export function assetBase(): string {
  return `gwb://${HOST}`
}

export function clientUrl(pkg: string): string {
  return `${assetBase()}${PREFIX}${pkg}/${CLIENT}`
}

/** URL → 要哪个包的浏览器那半。形状不对给 undefined */
export function parseAssetUrl(url: URL): { pkg: string } | undefined {
  if (url.hostname !== HOST || !url.pathname.startsWith(PREFIX)) return undefined
  let rest: string
  try {
    rest = decodeURIComponent(url.pathname.slice(PREFIX.length))
  } catch {
    return undefined
  }
  const cut = rest.lastIndexOf('/')
  if (cut <= 0 || rest.slice(cut + 1) !== CLIENT) return undefined
  return { pkg: rest.slice(0, cut) }
}
