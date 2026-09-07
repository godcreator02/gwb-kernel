import { describe, expect, it } from 'vitest'
import { asLogLevel, formatLogLine, parseCommandLine, parseHostLine } from '../src/shared/protocol'
import type { LogLine } from '../src/shared/protocol'

describe('parseHostLine', () => {
  it('认三种宿主消息', () => {
    expect(parseHostLine('{"t":"ready"}')).toEqual({ t: 'ready' })
    expect(parseHostLine('{"t":"reply","id":"a1","result":{"ok":true}}')).toEqual({
      t: 'reply',
      id: 'a1',
      result: { ok: true },
    })
    expect(parseHostLine('{"t":"event","payload":{"kind":"x"}}')).toEqual({
      t: 'event',
      payload: { kind: 'x' },
    })
  })

  it('reply 的 result 可以是任何东西，含 null 与 undefined 缺省', () => {
    expect(parseHostLine('{"t":"reply","id":"a1","result":null}')).toEqual({
      t: 'reply',
      id: 'a1',
      result: null,
    })
    expect(parseHostLine('{"t":"reply","id":"a1"}')).toEqual({ t: 'reply', id: 'a1', result: undefined })
  })

  it('不成话的行一律 undefined', () => {
    expect(parseHostLine('')).toBeUndefined()
    expect(parseHostLine('不是 json')).toBeUndefined()
    expect(parseHostLine('null')).toBeUndefined()
    expect(parseHostLine('42')).toBeUndefined()
    expect(parseHostLine('"ready"')).toBeUndefined()
    expect(parseHostLine('[{"t":"ready"}]')).toBeUndefined()
    expect(parseHostLine('{}')).toBeUndefined()
    expect(parseHostLine('{"t":"unknown"}')).toBeUndefined()
  })

  it('reply 的 id 必须是字符串——缺了它回执认不出是谁的', () => {
    expect(parseHostLine('{"t":"reply","result":1}')).toBeUndefined()
    expect(parseHostLine('{"t":"reply","id":7,"result":1}')).toBeUndefined()
  })

  it('认日志行', () => {
    const line = '{"t":"log","line":{"ts":1,"source":"plugin","level":"info","name":"gwb-cli","msg":"挂上了"}}'
    expect(parseHostLine(line)).toEqual({
      t: 'log',
      line: { ts: 1, source: 'plugin', level: 'info', name: 'gwb-cli', msg: '挂上了' },
    })
  })

  it('日志行不带 seq——那是主进程发的', () => {
    const line = '{"t":"log","line":{"ts":1,"source":"host","level":"warn","name":"stdin","msg":"x","seq":99}}'
    const parsed = parseHostLine(line)
    expect(parsed).toEqual({
      t: 'log',
      line: { ts: 1, source: 'host', level: 'warn', name: 'stdin', msg: 'x' },
    })
    expect(parsed).not.toHaveProperty('line.seq')
  })

  it('source 与 level 只认那两张表里的——脏值会在窗格上多出点不掉的挡位', () => {
    const bad = (patch: string): string => `{"t":"log","line":{"ts":1,"level":"info","name":"n","msg":"m",${patch}}}`
    expect(parseHostLine(bad('"source":"plugin"'))).toBeDefined()
    expect(parseHostLine(bad('"source":"kernel"'))).toBeUndefined()
    expect(parseHostLine(bad('"source":""'))).toBeUndefined()
    expect(parseHostLine(bad('"source":7'))).toBeUndefined()
    expect(
      parseHostLine('{"t":"log","line":{"ts":1,"source":"main","level":"trace","name":"n","msg":"m"}}'),
    ).toBeUndefined()
  })

  it('少一样就不认，空串消息与 0 时刻仍然算数', () => {
    const full = { ts: 0, source: 'main', level: 'debug', name: '', msg: '' }
    expect(parseHostLine(JSON.stringify({ t: 'log', line: full }))).toEqual({ t: 'log', line: full })
    for (const key of ['ts', 'source', 'level', 'name', 'msg']) {
      const partial: Record<string, unknown> = { ...full }
      delete partial[key]
      expect(parseHostLine(JSON.stringify({ t: 'log', line: partial }))).toBeUndefined()
    }
    expect(parseHostLine('{"t":"log"}')).toBeUndefined()
    expect(parseHostLine('{"t":"log","line":null}')).toBeUndefined()
    expect(parseHostLine('{"t":"log","line":[]}')).toBeUndefined()
  })
})

describe('asLogLevel', () => {
  it('electron 那个 warning 要转成 warn，其余同名', () => {
    expect(asLogLevel('warning')).toBe('warn')
    for (const l of ['error', 'warn', 'info', 'debug']) expect(asLogLevel(l)).toBe(l)
  })

  it('认不出的一律 info——不能让窗格多出一个点不掉的挡位', () => {
    expect(asLogLevel('trace')).toBe('info')
    expect(asLogLevel('')).toBe('info')
    expect(asLogLevel('ERROR')).toBe('info')
  })
})

describe('formatLogLine', () => {
  const at = (h: number, m: number, s: number, ms: number): number =>
    new Date(2026, 8, 7, h, m, s, ms).getTime()

  it('时间到毫秒、级别一个字母、然后是名字与正文', () => {
    const line: LogLine = { ts: at(9, 5, 3, 7), source: 'host', level: 'info', name: 'host', msg: 'up' }
    expect(formatLogLine(line)).toBe('09:05:03.007 I host up')
  })

  it('四路一个样——同一份文件里不该有两种格式', () => {
    const base = { ts: at(18, 36, 32, 898), msg: '一句话' }
    const got = [
      formatLogLine({ ...base, source: 'plugin', level: 'error', name: 'gwb-cli' }),
      formatLogLine({ ...base, source: 'main', level: 'warn', name: 'gwb' }),
      formatLogLine({ ...base, source: 'renderer', level: 'debug', name: 'renderer' }),
    ]
    expect(got).toEqual([
      '18:36:32.898 E gwb-cli 一句话',
      '18:36:32.898 W gwb 一句话',
      '18:36:32.898 D renderer 一句话',
    ])
  })
})

describe('parseCommandLine', () => {
  it('认命令行', () => {
    expect(parseCommandLine('{"t":"command","id":"c1","payload":{"command":"kernel.info"}}')).toEqual({
      t: 'command',
      id: 'c1',
      payload: { command: 'kernel.info', args: undefined },
    })
    expect(
      parseCommandLine('{"t":"command","id":"c1","payload":{"command":"x.y","args":{"n":1}}}'),
    ).toEqual({ t: 'command', id: 'c1', payload: { command: 'x.y', args: { n: 1 } } })
  })

  it('command 必须是字符串、id 必须是字符串', () => {
    expect(parseCommandLine('{"t":"command","id":"c1","payload":{}}')).toBeUndefined()
    expect(parseCommandLine('{"t":"command","id":"c1"}')).toBeUndefined()
    expect(parseCommandLine('{"t":"command","payload":{"command":"x"}}')).toBeUndefined()
    expect(parseCommandLine('{"t":"command","id":3,"payload":{"command":"x"}}')).toBeUndefined()
  })

  it('别的 t 不认', () => {
    expect(parseCommandLine('{"t":"ready"}')).toBeUndefined()
    expect(parseCommandLine('不是 json')).toBeUndefined()
  })
})
