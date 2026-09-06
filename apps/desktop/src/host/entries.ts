import fs from 'node:fs'
import path from 'node:path'
import { load as parseYaml } from 'js-yaml'

/**
 * 取址:从「装了哪些」到「一个能被 import 的地址」。
 * 装了哪些 = cordis.yml 的条目表;地址 = 位目录拼包名、清单里读入口。
 * 只认一个位（home 的 node_modules）、只认最直白的入口写法——不够用了再加。
 */

export interface Entry {
  id: string
  name: string
  config?: Record<string, unknown>
  disabled?: boolean
}

export function parseEntries(text: string): Entry[] {
  const doc = parseYaml(text) ?? []
  if (!Array.isArray(doc)) throw new Error(`cordis.yml 顶层应是条目数组,实得 ${typeof doc}`)
  return doc.map((raw: unknown, i) => {
    const e = raw as Partial<Entry>
    if (typeof e?.name !== 'string' || e.name === '') throw new Error(`cordis.yml 第 ${i + 1} 条没有 name`)
    const entry: Entry = { id: e.id ?? e.name, name: e.name }
    if (e.config !== undefined) entry.config = e.config
    if (e.disabled === true) entry.disabled = true
    return entry
  })
}

/** exports 的字符串写法、带条件的对象写法、main、index.js——四档,按这个顺序 */
function pickEntry(manifest: Record<string, unknown>): string | undefined {
  const exp = manifest.exports
  const root = typeof exp === 'object' && exp !== null && !Array.isArray(exp) ? (exp as Record<string, unknown>)['.'] ?? exp : exp
  if (typeof root === 'string') return root
  if (typeof root === 'object' && root !== null) {
    const cond = root as Record<string, unknown>
    for (const key of ['import', 'module', 'default']) {
      if (typeof cond[key] === 'string') return cond[key]
    }
  }
  if (typeof manifest.main === 'string') return manifest.main
  return 'index.js'
}

/** 包目录 → 入口的相对写法。清单读不到给 undefined——那跟「包不在」是一回事 */
export function entryFile(pkgDir: string): string | undefined {
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
  return pickEntry(manifest)
}

/** 包名 → 入口文件绝对路径。查不到是正当结果,不是错误 */
export function resolvePlugin(name: string, siteDir: string): string | undefined {
  const dir = path.join(siteDir, ...name.split('/'))
  const rel = entryFile(dir)
  if (rel === undefined) return undefined
  const file = path.resolve(dir, rel)
  // 入口指到包目录外就是坏包。认了它,一个包就能让宿主加载任意文件
  if (file !== dir && !file.startsWith(dir + path.sep)) return undefined
  return fs.existsSync(file) ? file : undefined
}
