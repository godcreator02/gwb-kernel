import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

/** `subpath` 缺省或 `.` 是主入口，`./x` 与 `x` 同义 */
function requireSpecifierFor(packageName: string, subpath: string): string {
  const subpathWithoutDotSlash = subpath === '.' ? '' : subpath.replace(/^\.\//, '')
  return subpathWithoutDotSlash === '' ? packageName : `${packageName}/${subpathWithoutDotSlash}`
}

/**
 * 把 home 里的包名（可带 exports 子路径）解析成文件路径；插件加载与页面 importmap 共用。
 * 必须先 realpath 再从真实目录解析：Node 的 CJS 解析缓存按「请求名 + 起点」记，逻辑路径不变时会返回上一版的文件
 */
export function resolveFromHome(dataDir: string, packageName: string, subpath = '.'): string {
  const realPackageDir = fs.realpathSync.native(path.join(dataDir, 'node_modules', ...packageName.split('/')))
  return createRequire(path.join(realPackageDir, 'package.json')).resolve(requireSpecifierFor(packageName, subpath))
}

/** 给 cordis loader 当 `internal.import` 用：按 home 解析包名，再按 ESM import */
export function bareImportFromHome(dataDir: string): (packageName: string) => Promise<unknown> {
  return (packageName) => import(pathToFileURL(resolveFromHome(dataDir, packageName)).href)
}
