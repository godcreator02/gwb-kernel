import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'

/**
 * main / preload 全 ESM（preload 因此不开 sandbox，contextIsolation 仍开）。
 * main 两入口:index（GUI 主进程）+ host（纯 node 宿主，ELECTRON_RUN_AS_NODE 拉起）。
 *
 * 依赖一律外置、走正常包解析——**不把任何依赖内联进束**（见仓根 CLAUDE.md）。
 * 外置名单从 package.json 现读:加依赖不必回来改这里，也就不会漏。
 * 不用 externalizeDepsPlugin——显式给 rollupOptions 会把它注入的 external 盖掉，
 * 而两个入口非得显式给 input 不可。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
}
const deps = Object.keys(manifest.dependencies ?? {})

function external(source: string): boolean {
  if (source === 'electron' || source.startsWith('node:')) return true
  return deps.some((dep) => source === dep || source.startsWith(`${dep}/`))
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: 'src/main/index.ts', host: 'src/host/main.ts' },
        external,
        output: { format: 'es', entryFileNames: '[name].mjs' },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        external,
        output: { format: 'es', entryFileNames: '[name].mjs' },
      },
    },
  },
  renderer: {},
})
