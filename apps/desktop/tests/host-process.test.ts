import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hostCommand, killHost, type Host } from '../src/main/host-process'
import { logBacklog } from '../src/main/logs'

/** 不真起进程的 Host：只喂 hostCommand / killHost 用得着的那几样 */
function fakeHost(killed = false, kill = (): void => {}): Host {
  return {
    proc: { killed, stdin: { write: () => true }, kill },
    pending: new Map(),
  } as unknown as Host
}

describe('命令通道', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('命令超时:回执按失败收,日志说得出是哪条', async () => {
    const host = fakeHost()
    const flight = hostCommand(host, { command: 'demo.slow' })
    vi.advanceTimersByTime(120_000)
    expect(await flight).toMatchObject({ ok: false, error: '命令超时' })
    const hit = logBacklog().find((e) => e.msg.includes('demo.slow'))
    expect(hit).toBeDefined()
    expect(hit).toMatchObject({ source: 'main', level: 'warn' })
  })

  it('宿主已经杀了:当场回失败,日志留一句', async () => {
    const host = fakeHost(true)
    expect(await hostCommand(host, { command: 'demo.x' })).toMatchObject({ ok: false, error: '宿主没在跑' })
    expect(logBacklog().some((e) => e.level === 'warn' && e.msg.includes('demo.x'))).toBe(true)
  })

  it('killHost 说一声再杀', () => {
    const kill = vi.fn()
    killHost(fakeHost(false, kill))
    expect(kill).toHaveBeenCalledOnce()
    expect(logBacklog().some((e) => e.level === 'info' && e.msg.includes('关宿主'))).toBe(true)
  })
})
