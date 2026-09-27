import { describe, expect, it } from 'vitest'
import { createBrowserImports } from '../src/browser-imports.js'

describe('浏览器模块登记', () => {
  it('拒绝路径键、前缀键和非本地模块地址；无效批次不留下登记', () => {
    const registry = createBrowserImports()
    const invalid: Record<string, string>[] = [{ './relative': 'file:///a.js' }, { 'prefix/': 'file:///a.js' }, { bad: 'https://example.com/a.js' }, { bad: 'file:///a.css' }]
    for (const mapping of invalid) {
      expect(() => registry.register({ valid: 'file:///a.js', ...mapping })).toThrow()
      expect(registry.snapshot()).toEqual({})
    }
  })
  it('同名同地址复用，最后一个登记者撤销后才移除；冲突整批失败', () => {
    const registry = createBrowserImports()
    const first = registry.register({ '@demo/runtime': 'file:///runtime.js' })
    const second = registry.register({ '@demo/runtime': 'file:///runtime.js' })
    expect(registry.snapshot()).toEqual({ '@demo/runtime': 'file:///runtime.js' })
    expect(() => registry.register({ fresh: 'file:///fresh.js', '@demo/runtime': 'file:///other.js' })).toThrow(/runtime.js.*other.js/)
    expect(registry.snapshot()).toEqual({ '@demo/runtime': 'file:///runtime.js' })
    first()
    first()
    expect(registry.snapshot()).toEqual({ '@demo/runtime': 'file:///runtime.js' })
    second()
    expect(registry.snapshot()).toEqual({})
    registry.register({ '@demo/runtime': 'file:///other.js' })
    expect(registry.snapshot()).toEqual({ '@demo/runtime': 'file:///other.js' })
  })
})
