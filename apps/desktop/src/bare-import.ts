import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

/**
 * 裸名（node 半）的 import：先 `realpathSync.native` 把 `<home>/node_modules/<裸名>` 解成
 * 真实目录，再从那儿起 `createRequire` 按 CJS 条件（含 `exports` 表）解析到入口文件、按 ESM
 * import 进来。realpath 不是绕路，是热重挂的全部要害：Node 的 CJS 解析带进程级缓存，件换了
 * 版本、逻辑路径没变时它仍旧回旧版本的真实路径；真实路径（pnpm 布局里含版本号那截）天然
 * 不跟上一版撞。找不到时 ENOENT 带着完整路径。见文档站
 *
 * 这个文件不碰 electron、不碰 cordis：副作用只有磁盘读——单测直接喂一个临时 home 目录
 * 就能跑（loader 那头的用法是 `ctx.loader.internal = { import: bareImportFromHome(home) }`）
 */
export function bareImportFromHome(dataDir: string): (name: string) => Promise<unknown> {
  return (name) => {
    const real = fs.realpathSync.native(path.join(dataDir, 'node_modules', ...name.split('/')))
    return import(pathToFileURL(createRequire(path.join(real, 'package.json')).resolve(name)).href)
  }
}
