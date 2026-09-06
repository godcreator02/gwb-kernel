import { describe, expect, it } from 'vitest'
import { parseCommandLine, parseHostLine } from '../src/shared/protocol'

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
