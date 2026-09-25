import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 页面 importmap 写死在 index.html 里：四个 react 包名指向打包脚本产出的文件。
 * 读源文件与构建产物（根目录 pnpm check 先构建内核包），不起 electron；页面上真的加载到这四个文件只能实机验证
 */

const packageDir = path.join(import.meta.dirname, '..')

function staticImportmap(): Record<string, string> {
  const html = fs.readFileSync(path.join(packageDir, 'src', 'index.html'), 'utf8')
  const importmapScripts = [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)]
  expect(importmapScripts).toHaveLength(1)
  return (JSON.parse(importmapScripts[0]![1]!) as { imports: Record<string, string> }).imports
}

describe('页面的 importmap', () => {
  it('index.html 里只有 react 的四个包名，写在页面脚本之前', () => {
    expect(Object.keys(staticImportmap()).sort()).toEqual(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'])
    const html = fs.readFileSync(path.join(packageDir, 'src', 'index.html'), 'utf8')
    expect(html.indexOf('<script type="importmap">')).toBeLessThan(html.indexOf('<script type="module">'))
  })

  it('每个地址都是相对 index.html 的 ./react/<文件>，构建后 dist/ 里有这个文件', () => {
    for (const url of Object.values(staticImportmap())) {
      expect(url).toMatch(/^\.\/react\/[a-z-]+\.js$/)
      expect(fs.existsSync(path.join(packageDir, 'dist', url))).toBe(true)
    }
  })
})

describe('本仓的内核包清单', () => {
  it('包根的 types 指向接口类型那份 d.ts，default 是内核入口；清单顶层不写 types，类型只经 exports 给出', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
      main: string
      exports: Record<string, unknown>
    }
    expect(manifest.exports['.']).toEqual({ types: './dist/api.d.ts', default: './dist/main.js' })
    expect(manifest).not.toHaveProperty('types')
    expect(manifest.main).toBe('dist/main.js')
  })
})
