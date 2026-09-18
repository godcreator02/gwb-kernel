import { describe, expect, it } from 'vitest'
import { requireKernel, isRecord } from '../src/index'

/**
 * 词汇表包的判据：零运行时依赖的契约面，测的就是「名字还在、形状没变、错话说得清」。
 * requireKernel 的报错话是件作者排障的第一条线索，钉住原话
 */

describe('requireKernel', () => {
  it('服务在就原样返回那一份', () => {
    const api = {
      dataDir: 'x',
      version: '0.0.0',
      emit: () => {},
      setShell: () => () => {},
    }
    expect(requireKernel({ gwbKernel: api })).toBe(api)
  })

  it('服务不在（undefined 或整格没有）抛错，话里说清发生了什么', () => {
    const kernelGone = { gwbKernel: undefined } as unknown as Parameters<typeof requireKernel>[0]
    expect(() => requireKernel(kernelGone)).toThrow('ctx.gwbKernel 不在')
    expect(() => requireKernel({} as Parameters<typeof requireKernel>[0])).toThrow(
      '这个插件跑在一个不是 gwb 内核的 cordis 宿主里',
    )
  })
})

describe('isRecord', () => {
  it('普通对象与无原型的对象是；null、数组、原始值不是', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord(Object.create(null))).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord('x')).toBe(false)
    expect(isRecord(42)).toBe(false)
  })
})
