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

/** 一条 exports 值 → 相对写法:字符串就是它,条件对象按 import/module/default 往下取 */
function pickCondition(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null) return undefined
  const cond = value as Record<string, unknown>
  for (const key of ['import', 'module', 'default']) {
    const hit = pickCondition(cond[key])
    if (hit !== undefined) return hit
  }
  return undefined
}

/** exports 里对应的子路径、main、index.js——按这个顺序。子路径不落 main/index:那两样只说主入口是谁 */
function pickEntry(manifest: Record<string, unknown>, subpath: string): string | undefined {
  const exp = manifest.exports
  if (typeof exp === 'string') return subpath === '.' ? exp : undefined
  if (typeof exp === 'object' && exp !== null) {
    const table = exp as Record<string, unknown>
    // 没有 '.' 键时整个对象就是主入口的条件表（exports: { import: './x.js' } 这种写法）
    const value = subpath in table ? table[subpath] : subpath === '.' && !('.' in table) ? exp : undefined
    const hit = pickCondition(value)
    if (hit !== undefined) return hit
  }
  if (subpath !== '.') return undefined
  if (typeof manifest.main === 'string') return manifest.main
  return 'index.js'
}

/** 包目录 → 某个子路径入口的相对写法。清单读不到给 undefined——那跟「包不在」是一回事 */
export function entryFile(pkgDir: string, subpath = '.'): string | undefined {
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
  return pickEntry(manifest, subpath)
}

/** 包清单里的 gwb 段:件自己声明的元信息。只认这里用得上的两条 */
export function pluginMeta(pkgDir: string): { shell?: boolean } | undefined {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as {
      gwb?: { shell?: unknown }
    }
    return { shell: manifest.gwb?.shell === true }
  } catch {
    return undefined
  }
}

/** 包名 → 位里的包目录 */
export function pluginDir(name: string, siteDir: string): string {
  return path.join(siteDir, ...name.split('/'))
}

/** 包名 → 入口文件绝对路径。查不到是正当结果,不是错误 */
export function resolvePlugin(name: string, siteDir: string, subpath = '.'): string | undefined {
  const dir = pluginDir(name, siteDir)
  const rel = entryFile(dir, subpath)
  if (rel === undefined) return undefined
  const file = path.resolve(dir, rel)
  // 入口指到包目录外就是坏包。认了它,一个包就能让宿主加载任意文件
  if (file !== dir && !file.startsWith(dir + path.sep)) return undefined
  return fs.existsSync(file) ? file : undefined
}
