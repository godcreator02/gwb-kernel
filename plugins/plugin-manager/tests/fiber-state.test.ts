import { describe, expect, it } from 'vitest'
import { FIBER_STATE as KERNEL_FIBER_STATE } from '../../../apps/desktop/src/entry-state'
import { FIBER_STATE, fiberStateOf } from '../src/update-all'

/**
 * 条目状态名有两份：内核的只读状态页用一份，plugin-manager 的回执用一份。插件不能 import 内核应用的文件，
 * 所以各存一份，由这里保证两份一致——cordis 改了 FiberState 的顺序时，两边要一起改。
 */
describe('条目状态名和内核一致', () => {
  it('两份状态名表完全相同', () => {
    expect([...FIBER_STATE]).toEqual([...KERNEL_FIBER_STATE])
  })

  it('fiberStateOf 按这张表报状态名', () => {
    KERNEL_FIBER_STATE.forEach((name, state) => {
      expect(fiberStateOf({ fiber: { state } })).toBe(name)
    })
  })
})
