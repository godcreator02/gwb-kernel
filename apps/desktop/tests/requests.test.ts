import { describe, expect, it, vi } from 'vitest'
import { createRequests } from '../src/requests.js'

describe('页面请求通道', () => {
  it('按通道传递任意载荷和返回值，不解释业务协议', async () => {
    const requests = createRequests()
    requests.handle('sample', (value) => ({ received: value }))
    expect(await requests.dispatch('sample', [1, 'two'])).toEqual({ available: true, value: { received: [1, 'two'] } })
    expect(await requests.dispatch('missing', undefined)).toEqual({ available: false })
  })

  it('重复登记拒绝；注销幂等，旧注销函数不能移除后来的登记', async () => {
    const requests = createRequests()
    const off = requests.handle('sample', () => 1)
    expect(() => requests.handle('sample', () => 2)).toThrow(/sample/)
    off()
    requests.handle('sample', () => 3)
    off()
    expect(await requests.dispatch('sample', null)).toEqual({ available: true, value: 3 })
  })

  it('注销拒绝新请求，已开始的异步请求仍可完成；处理器异常原样拒绝', async () => {
    const requests = createRequests()
    let finish!: (value: number) => void
    const off = requests.handle('slow', () => new Promise<number>((resolve) => { finish = resolve }))
    const pending = requests.dispatch('slow', undefined)
    off()
    expect(await requests.dispatch('slow', undefined)).toEqual({ available: false })
    finish(42)
    expect(await pending).toEqual({ available: true, value: 42 })
    const error = new Error('broken')
    requests.handle('broken', () => { throw error })
    await expect(requests.dispatch('broken', null)).rejects.toBe(error)
  })

  it('无效通道不进入处理器', async () => {
    const requests = createRequests()
    const handler = vi.fn()
    expect(() => requests.handle('', handler)).toThrow()
    await expect(requests.dispatch(42, null)).rejects.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })
})
