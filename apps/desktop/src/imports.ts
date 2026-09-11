import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

/**
 * 浏览器半的取址：页面上的裸名（react 那一族）指到 home 里哪个文件。提供方在自己的
 * package.json 里声明 `gwb.shared`（裸名 → exports 子路径），这里扫 home 清单收齐、解析成
 * `file://` importmap。不认识 react 这个词，只搬运提供方的声明；共享包没有 node 半，
 * 清单是它唯一能说话的地方。撞名只认先到的，warn 一声。
 *
 * 这个文件不碰 electron、不碰 cordis：副作用只有磁盘读，warn 也由调用方注入——单测直接
 * 喂一个临时 home 目录就能跑
 */
export interface CollectImportsDeps {
  /** home 的目录，包清单与 node_modules 都从它推 */
  dataDir: string
  /** 解析裸名的起点，kernel 里传 `ctx.baseUrl`；缺省用 dataDir */
  baseUrl?: string
  /** 警告往哪说（kernel 里是 `ctx.logger('kernel').warn`） */
  warn: (msg: string) => void
}

const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))

export function collectImports(deps: CollectImportsDeps): Record<string, string> {
  const imports: Record<string, string> = {}
  const resolver = createRequire(deps.baseUrl ?? pathToFileURL(deps.dataDir + path.sep).href)
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
      if (imports[bare] !== undefined) {
        deps.warn(`裸名 ${bare} 有两个提供方，只认先到的，${pkg} 的那条忽略`)
        continue
      }
      try {
        imports[bare] = pathToFileURL(resolver.resolve(`${pkg}/${sub.replace(/^\.\//, '')}`)).href
      } catch (err) {
        deps.warn(`${pkg} 声明的 ${bare} → ${sub} 解析不到：${stackOf(err)}`)
      }
    }
  }
  return imports
}
