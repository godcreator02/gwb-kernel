// 构建的最后一步：把页面的两个文件、两个内置插件复制进 dist/。
// 内置插件的构建产物除 node 内置模块外没有包名 import（各自的 artifact 测试守着），复制过去就能运行；
// 说明书按 new URL('../skills/', import.meta.url) 找，所以 dist 与 skills 保持同级
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(appDir, 'dist')

for (const file of ['index.html', 'preload.cjs']) {
  fs.copyFileSync(path.join(appDir, 'src', file), path.join(dist, file))
}

const BUILTIN_PLUGINS = ['commands', 'plugin-manager']
const builtinRoot = path.join(dist, 'builtin')
// 每次整个重建，不留上一次构建剩下的文件
fs.rmSync(builtinRoot, { recursive: true, force: true })
for (const dir of BUILTIN_PLUGINS) {
  const from = path.resolve(appDir, '..', '..', 'plugins', dir)
  const to = path.join(builtinRoot, dir)
  if (!fs.existsSync(path.join(from, 'dist', 'index.js'))) {
    throw new Error(`内置插件 ${dir} 还没构建：${path.join(from, 'dist', 'index.js')} 不存在`)
  }
  fs.mkdirSync(to, { recursive: true })
  fs.copyFileSync(path.join(from, 'package.json'), path.join(to, 'package.json'))
  fs.cpSync(path.join(from, 'dist'), path.join(to, 'dist'), { recursive: true })
  if (fs.existsSync(path.join(from, 'skills'))) fs.cpSync(path.join(from, 'skills'), path.join(to, 'skills'), { recursive: true })
}
