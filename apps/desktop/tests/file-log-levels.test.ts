import { describe, expect, it } from 'vitest'
import { fileLogLevels } from '../src/file-log-levels'

describe('fileLogLevels：写进 gwb.log 的级别', () => {
  it('没设 GWB_DEBUG 或设成空串：只收 info 及以上', () => {
    expect(fileLogLevels(undefined)).toEqual({ default: 2 })
    expect(fileLogLevels('')).toEqual({ default: 2 })
  })

  it('点名的 logger 连 debug 也收，名字两边的空格去掉，其余照旧只收 info 及以上', () => {
    expect(fileLogLevels('gwb-commands, renderer')).toEqual({ default: 2, 'gwb-commands': 3, renderer: 3 })
  })

  it('逗号之间是空的就报错，写明给的原值', () => {
    for (const bad of ['gwb-commands,', ',gwb-commands', 'a,,b', ' ']) {
      expect(() => fileLogLevels(bad)).toThrow(`GWB_DEBUG 给的是 ${JSON.stringify(bad)}：逗号之间不能是空的`)
    }
  })

  it('写了 default 就报错：它是 cordis 级别表的保留项', () => {
    expect(() => fileLogLevels('gwb-commands,default')).toThrow('GWB_DEBUG 里不能写 default')
  })
})
