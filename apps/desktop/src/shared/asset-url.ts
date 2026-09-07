/**
 * 桥的取货通道，约定一条 URL：`gwb://asset/plugins/<包名>/<子路径>`。
 * 子路径就是包 exports 表里的键去掉开头那两个字符（`./client` → `client`）。
 * 包名带 scope 是两段，所以「`@` 开头吃两段、否则吃一段，剩下全是子路径」。
 */

const HOST = 'asset'
const PREFIX = '/plugins/'

export function assetBase(): string {
  return `gwb://${HOST}`
}

/** 包名 + exports 子路径（`./client` 或 `client` 都收）→ 取货地址 */
export function assetUrl(pkg: string, sub: string): string {
  return `${assetBase()}${PREFIX}${pkg}/${sub.startsWith('./') ? sub.slice(2) : sub}`
}

/** 件的浏览器那半，约定住 exports 的 `./client` */
export function clientUrl(pkg: string): string {
  return assetUrl(pkg, 'client')
}

/** URL → 要哪个包的哪个子路径；sub 回的是 exports 键的写法。形状不对给 undefined */
export function parseAssetUrl(url: URL): { pkg: string; sub: string } | undefined {
  if (url.hostname !== HOST || !url.pathname.startsWith(PREFIX)) return undefined
  let rest: string
  try {
    rest = decodeURIComponent(url.pathname.slice(PREFIX.length))
  } catch {
    return undefined
  }
  const parts = rest.split('/')
  const pkgLen = parts[0]?.startsWith('@') ? 2 : 1
  // 包名占掉之后必须还剩东西，否则这条地址没说要什么
  if (parts.length <= pkgLen) return undefined
  const pkgParts = parts.slice(0, pkgLen)
  const subParts = parts.slice(pkgLen)
  // 空段不认（`a/b//client` 这种）。点段这儿不判：`new URL` 已经把 `..` 与 `%2e%2e` 一并
  // 规范化掉了，判了也是死代码；越界那道防线在 resolvePlugin 的包目录前缀检查上
  if (pkgParts.some((p) => p === '') || subParts.some((p) => p === '')) return undefined
  return { pkg: pkgParts.join('/'), sub: `./${subParts.join('/')}` }
}
