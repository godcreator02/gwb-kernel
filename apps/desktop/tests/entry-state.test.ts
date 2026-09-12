import { describe, expect, it } from 'vitest'
import type { Entry } from '@cordisjs/plugin-loader'
import { describeEntry } from '../src/entry-state'

/**
 * 条目状态分类器的判据：手造 Entry（fiber 是 cordis 标了 private 的形状，照它现在的字段拼），
 * 锁的是页面那份只读现状会说出什么——排障的人靠这些话认局面，错一个词就是误导
 */

/** 手造一个条目：fiber 的形状照 cordis 现在的实现拼（state 数字照 FiberState 的定义） */
function fakeEntry(fiber?: unknown, disabled = false): Entry {
  return { disabled, fiber } as unknown as Entry
}

describe('describeEntry', () => {
  it('disabled 条目不问 fiber，直接说 disabled', () => {
    expect(describeEntry(fakeEntry({ state: 2 }, true))).toBe('disabled')
  })

  it('没有 fiber（模块 import 失败）说 no fiber，话里指去错误行', () => {
    expect(describeEntry(fakeEntry(undefined))).toBe('no fiber（import 失败，原因在错误行里）')
  })

  it('常规状态照 FiberState 原名照抄', () => {
    expect(describeEntry(fakeEntry({ state: 1, inject: {} }))).toBe('LOADING')
    expect(describeEntry(fakeEntry({ state: 2, inject: {} }))).toBe('ACTIVE')
    expect(describeEntry(fakeEntry({ state: 4, inject: {} }))).toBe('DISPOSED')
    expect(describeEntry(fakeEntry({ state: 5, inject: {} }))).toBe('UNLOADING')
  })

  it('PENDING 带上还缺哪个服务：inject 里没进 _store 的那些；一个不缺就说 ？', () => {
    const waiting = { state: 0, inject: { gwbCommands: null, gwbShell: null }, _store: { gwbShell: {} } }
    expect(describeEntry(fakeEntry(waiting))).toBe('PENDING（缺 gwbCommands）')
    expect(describeEntry(fakeEntry({ state: 0, inject: {}, _store: {} }))).toBe('PENDING（缺 ？）')
  })

  it('FAILED 带错误的第一行：Error 取 stack 头一行，非 Error 就 String', () => {
    const errored = { state: 3, inject: {}, _error: new Error('第一行\n第二行') }
    expect(describeEntry(fakeEntry(errored))).toBe('FAILED：Error: 第一行')
    expect(describeEntry(fakeEntry({ state: 3, inject: {}, _error: '字符串错' }))).toBe('FAILED：字符串错')
  })

  it('认不出的状态数字原样报出来', () => {
    expect(describeEntry(fakeEntry({ state: 99, inject: {} }))).toBe('state=99')
  })
})
