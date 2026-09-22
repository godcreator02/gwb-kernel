import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveFromHome } from './bare-import.js'

/**
 * 浏览器半的取址：页面上的裸名（react 那一族）指到 home 里哪个文件。提供方在自己的
 * package.json 里声明 `gwb.shared`（裸名 → exports 子路径），这里扫 home 清单收齐、经
 * `resolveFromHome`（与 node 半同一条解析）解成 `file://` importmap。每次调用都现算，共享包
 * 换了版本，下一次调用就指到新版本的真实路径。不认识 react 这个词，只搬运提供方的声明；共享包
 * 没有 node 半，清单是它唯一能说话的地方。撞名全部拒绝：该裸名不进表，页面 import 它直接报解析错误。
 *
 * 这个文件不碰 electron、不碰 cordis：副作用只有磁盘读，warn 也由调用方注入——单测直接
 * 喂一个临时 home 目录就能跑
 */
export interface CollectImportsDeps {
  /** home 的目录，包清单与 node_modules 都从它推 */
  dataDir: string
  /** 警告往哪说（kernel 里是 `ctx.logger('kernel').warn`） */
  warn: (msg: string) => void
}

const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))

export function collectImports(deps: CollectImportsDeps): Record<string, string> {
  const imports: Record<string, string> = {}
  const conflicted = new Set<string>()
  let packages: string[] = []
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(deps.dataDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, unknown>
    }
    packages = Object.keys(manifest.dependencies ?? {})
  } catch {
    /* 没有清单就没有共享包 */
  }
  for (const pkg of packages) {
    let shared: unknown
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(deps.dataDir, 'node_modules', ...pkg.split('/'), 'package.json'), 'utf8'),
      ) as { gwb?: { shared?: unknown } }
      shared = manifest.gwb?.shared
    } catch {
      continue
    }
    if (typeof shared !== 'object' || shared === null) continue
    for (const [bare, sub] of Object.entries(shared as Record<string, unknown>)) {
      if (bare === '' || typeof sub !== 'string' || sub === '') continue
      if (imports[bare] !== undefined || conflicted.has(bare)) {
        if (imports[bare] !== undefined) {
          delete imports[bare]
          conflicted.add(bare)
        }
        deps.warn(`裸名 ${bare} 有多个提供方，全部拒绝：importmap 不收录这个名字（本次为 ${pkg} 的声明）`)
        continue
      }
      try {
        imports[bare] = pathToFileURL(resolveFromHome(deps.dataDir, pkg, sub)).href
      } catch (err) {
        deps.warn(`${pkg} 声明的 ${bare} → ${sub} 解析不到：${stackOf(err)}`)
      }
    }
  }
  return imports
}
