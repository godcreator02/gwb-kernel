import { describe, expect, it } from 'vitest'
import { assertKernelConfig } from '../src/index.js'

describe('只接受内核交来的 config', () => {
  it('home 与 pnpm 都是字符串：通过', () => {
    expect(() => assertKernelConfig({ home: 'home', pnpm: 'C:\\gwb\\resources\\pnpm\\pnpm.exe' })).not.toThrow()
  })

  it('cordis.yml 里旧版留下的条目没有 config：报错，说明要删掉那条条目', () => {
    for (const config of [undefined, {}, { home: 'home' }, { pnpm: 'x' }]) {
      expect(() => assertKernelConfig(config)).toThrow(/旧版留下的，删掉它/)
    }
  })
})
