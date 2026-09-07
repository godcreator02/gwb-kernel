import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogHub } from '../src/main/logs'
import type { LogEntry, LogLine } from '../src/shared/protocol'

const line = (msg: string, patch: Partial<LogLine> = {}): LogLine => ({
  ts: 1,
  source: 'main',
  level: 'info',
  name: 'test',
  msg,
  ...patch,
})

describe('环形缓冲', () => {
  it('发的号从 1 起、单调递增', () => {
    const hub = createLogHub()
    hub.push(line('a'))
    hub.push(line('b'))
    hub.push(line('c'))
    expect(hub.backlog().map((e) => e.seq)).toEqual([1, 2, 3])
  })

  it('号跟内容无关——同一毫秒里两句一模一样的话是两条', () => {
    const hub = createLogHub()
    hub.push(line('同一句'))
    hub.push(line('同一句'))
    const got = hub.backlog()
    expect(got).toHaveLength(2)
    expect(got[0]!.seq).not.toBe(got[1]!.seq)
  })

  it('满了丢最老的，号不重置', () => {
    const hub = createLogHub(3)
    for (const msg of ['a', 'b', 'c', 'd', 'e']) hub.push(line(msg))
    const got = hub.backlog()
    expect(got.map((e) => e.msg)).toEqual(['c', 'd', 'e'])
    expect(got.map((e) => e.seq)).toEqual([3, 4, 5])
  })

  it('backlog 给的是副本，改它不动内部', () => {
    const hub = createLogHub()
    hub.push(line('a'))
    hub.backlog().push({ seq: 99 } as LogEntry)
    expect(hub.backlog()).toHaveLength(1)
  })

  it('原样保留 source 与 level', () => {
    const hub = createLogHub()
    hub.push(line('炸了', { source: 'plugin', level: 'error', name: 'gwb-cli' }))
    expect(hub.backlog()[0]).toMatchObject({ source: 'plugin', level: 'error', name: 'gwb-cli' })
  })
})

describe('推给窗口', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('没有 sink 时照常入缓冲——窗口就绪之前那些正是最该留的', () => {
    const hub = createLogHub()
    hub.push(line('起步'))
    hub.push(line('件挂不上'))
    expect(hub.backlog().map((e) => e.msg)).toEqual(['起步', '件挂不上'])
  })

  it('sink 装上之后只推新的，旧的靠 backlog 取', () => {
    const hub = createLogHub()
    hub.push(line('窗口之前'))
    const batches: LogEntry[][] = []
    hub.setSink((b) => batches.push(b))
    hub.push(line('窗口之后'))
    vi.advanceTimersByTime(200)
    expect(batches.flat().map((e) => e.msg)).toEqual(['窗口之后'])
    expect(hub.backlog()).toHaveLength(2)
  })

  it('攒够一段时间才推，一批一次', () => {
    const hub = createLogHub()
    const batches: LogEntry[][] = []
    hub.setSink((b) => batches.push(b))
    hub.push(line('a'))
    hub.push(line('b'))
    hub.push(line('c'))
    expect(batches).toHaveLength(0)
    vi.advanceTimersByTime(200)
    expect(batches).toHaveLength(1)
    expect(batches[0]!.map((e) => e.msg)).toEqual(['a', 'b', 'c'])
  })

  it('下一批另起一个定时器', () => {
    const hub = createLogHub()
    const batches: LogEntry[][] = []
    hub.setSink((b) => batches.push(b))
    hub.push(line('a'))
    vi.advanceTimersByTime(200)
    hub.push(line('b'))
    vi.advanceTimersByTime(200)
    expect(batches.map((b) => b.map((e) => e.msg))).toEqual([['a'], ['b']])
  })

  it('sink 撤了就不推，攒着的那批也丢掉——但缓冲里还在', () => {
    const hub = createLogHub()
    const batches: LogEntry[][] = []
    hub.setSink((b) => batches.push(b))
    hub.push(line('窗关了'))
    hub.setSink(null)
    vi.advanceTimersByTime(200)
    expect(batches).toHaveLength(0)
    expect(hub.backlog()).toHaveLength(1)
  })
})
