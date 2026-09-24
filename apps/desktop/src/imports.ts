import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveFromPackageDir } from './bare-import.js'

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** `gwb.shared` 的「包名 → exports 子路径」；不是对象、键是空串、值不是非空字符串的条目一律跳过 */
function validSharedDeclarations(declared: unknown): [bareName: string, subpath: string][] {
  if (typeof declared !== 'object' || declared === null) return []
  return Object.entries(declared as Record<string, unknown>).filter(
    (declaration): declaration is [string, string] => declaration[0] !== '' && typeof declaration[1] === 'string' && declaration[1] !== '',
  )
}

/**
 * 页面的 importmap：内核包自己 `gwb.shared` 声明的包名 → 打包产物的 `file://` 地址。home 里别的包写了 `gwb.shared` 不收。
 * 进程启动时算一次；解析不到说明内核包本身不完整，直接抛出
 */
export function kernelSharedImports(kernelPackageDir: string): Record<string, string> {
  const manifest = readJson(path.join(kernelPackageDir, 'package.json')) as { name: string; gwb?: { shared?: unknown } }
  const fileUrlsByBareName: Record<string, string> = {}
  for (const [bareName, subpath] of validSharedDeclarations(manifest.gwb?.shared)) {
    fileUrlsByBareName[bareName] = pathToFileURL(resolveFromPackageDir(kernelPackageDir, manifest.name, subpath)).href
  }
  return fileUrlsByBareName
}
