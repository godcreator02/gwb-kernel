import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

/**
 * home 里的裸名解析，node 半与浏览器半共用：先 `realpathSync.native` 把
 * `<home>/node_modules/<包名>` 解成真实目录，再从那儿起 `createRequire` 按 CJS 条件（含
 * `exports` 表）解析 `<包名>` 或 `<包名>/<子路径>` 到文件。realpath 是要害：Node 的 CJS 解析
 * 带进程级缓存，键是请求名加起点，包换了版本、逻辑路径没变时同一对键仍回旧版本的真实路径；
 * 真实路径（pnpm 布局里含版本号那截）天然不跟上一版撞。找不到时 ENOENT 带着完整路径。见文档站
 *
 * `sub` 缺省或 `.` 是主入口；`./x` 与 `x` 同义
 *
 * 这个文件不碰 electron、不碰 cordis：副作用只有磁盘读——单测直接喂一个临时 home 目录就能跑
 */
export function resolveFromHome(dataDir: string, pkg: string, sub = '.'): string {
  const real = fs.realpathSync.native(path.join(dataDir, 'node_modules', ...pkg.split('/')))
  const rest = sub === '.' ? '' : sub.replace(/^\.\//, '')
  return createRequire(path.join(real, 'package.json')).resolve(rest === '' ? pkg : `${pkg}/${rest}`)
}

/**
 * 裸名（node 半）的 import：`resolveFromHome` 解到入口文件，按 ESM import 进来。loader 那头
 * 的用法是 `ctx.loader.internal = { import: bareImportFromHome(home) }`
 */
export function bareImportFromHome(dataDir: string): (name: string) => Promise<unknown> {
  return (name) => import(pathToFileURL(resolveFromHome(dataDir, name)).href)
}
