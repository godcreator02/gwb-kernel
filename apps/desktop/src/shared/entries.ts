import fs from 'node:fs'
import path from 'node:path'

/**
 * 包名 → 盘上的文件，给主进程的 `gwb://` 用。
 * 挂载不走这儿，那归 loader。取舍见文档站。
 */

/** 一条 exports 值 → 相对写法：字符串就是它，条件对象按 import/module/default 往下取 */
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

/** exports 里对应的子路径 → main → index.js。子路径不落 main/index */
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

/** 包目录 → 某个子路径入口的相对写法。清单读不到给 undefined */
export function entryFile(pkgDir: string, subpath = '.'): string | undefined {
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
  return pickEntry(manifest, subpath)
}

/**
 * 包声明的 `gwb.shared`：裸名 → 本包的 exports 子路径，「我给页面提供这几个裸名」。
 * 盘上的清单谁都能手改，逐条宽容：站不住的那条剔掉，别让一条坏声明废掉整包。
 */
function readShared(raw: unknown): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, string> = {}
  for (const [bare, sub] of Object.entries(raw as Record<string, unknown>)) {
    if (bare === '' || typeof sub !== 'string' || sub === '') continue
    out[bare] = sub
  }
  return Object.keys(out).length === 0 ? undefined : out
}

/** 包清单里的 gwb 段：件自己声明的元信息 */
export function pluginMeta(pkgDir: string): { shell?: boolean; shared?: Record<string, string> } | undefined {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as {
      gwb?: { shell?: unknown; shared?: unknown }
    }
    return { shell: manifest.gwb?.shell === true, shared: readShared(manifest.gwb?.shared) }
  } catch {
    return undefined
  }
}

/** 包名 → 位里的包目录 */
export function pluginDir(name: string, siteDir: string): string {
  return path.join(siteDir, ...name.split('/'))
}

/** 包名 → 入口文件绝对路径。查不到是正当结果 */
export function resolvePlugin(name: string, siteDir: string, subpath = '.'): string | undefined {
  const dir = pluginDir(name, siteDir)
  const rel = entryFile(dir, subpath)
  if (rel === undefined) return undefined
  const file = path.resolve(dir, rel)
  // 越界检查：入口指到包目录外一律不认
  if (file !== dir && !file.startsWith(dir + path.sep)) return undefined
  return fs.existsSync(file) ? file : undefined
}
