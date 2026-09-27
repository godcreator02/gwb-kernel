import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const packageDir = path.join(import.meta.dirname, '..')

describe('页面的 importmap', () => {
  it('内核不提供固定的 UI 模块，映射只能由插件登记', () => {
    const html = fs.readFileSync(path.join(packageDir, 'src', 'index.html'), 'utf8')
    expect(html).not.toContain('type="importmap"')
    expect(fs.existsSync(path.join(packageDir, 'dist', 'react'))).toBe(false)
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
