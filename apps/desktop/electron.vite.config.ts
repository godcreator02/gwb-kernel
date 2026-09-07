import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'

/**
 * main / preload 全 ESM。main 两入口：index（GUI 主进程）+ host（纯 node 宿主）。
 * 依赖一律外置、走正常包解析，名单从 package.json 现读。取舍见文档站。
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
