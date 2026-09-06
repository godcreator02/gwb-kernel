import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { entryFile, parseEntries, resolvePlugin } from '../src/host/entries'

describe('parseEntries', () => {
  it('读出条目', () => {
    expect(parseEntries('- name: "@a/one"\n- name: "@a/two"\n  disabled: true\n')).toEqual([
      { id: '@a/one', name: '@a/one' },
      { id: '@a/two', name: '@a/two', disabled: true },
    ])
  })

  it('id 没写就用 name;config 原样带上', () => {
    expect(parseEntries('- id: x\n  name: "@a/one"\n  config:\n    port: 1\n')).toEqual([
      { id: 'x', name: '@a/one', config: { port: 1 } },
    ])
  })

  it('空文件给空表', () => {
    expect(parseEntries('')).toEqual([])
    expect(parseEntries('[]')).toEqual([])
  })

  it('顶层不是数组、条目没有 name,都要响亮地失败', () => {
    expect(() => parseEntries('a: 1')).toThrow()
    expect(() => parseEntries('- config: {}')).toThrow()
  })
})

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwbk-'))
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

function makePkg(name: string, manifest: unknown, files: string[]): string {
  const dir = path.join(tmp, 'node_modules', ...name.split('/'))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest))
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    fs.writeFileSync(path.join(dir, f), '')
  }
  return dir
}

describe('entryFile', () => {
  it('认 exports 的字符串写法', () => {
    const dir = makePkg('@a/exp', { exports: { '.': './lib/index.js' } }, ['lib/index.js'])
    expect(entryFile(dir)).toBe('./lib/index.js')
  })

  it('认 exports 的对象写法（default 条件）', () => {
    const dir = makePkg('@a/cond', { exports: { '.': { default: './lib/x.js' } } }, ['lib/x.js'])
    expect(entryFile(dir)).toBe('./lib/x.js')
  })

  it('exports 整个是一条字符串也认', () => {
    const dir = makePkg('@a/flat', { exports: './m.js' }, ['m.js'])
    expect(entryFile(dir)).toBe('./m.js')
  })

  it('没有 exports 落 main,再落 index.js', () => {
    expect(entryFile(makePkg('@a/mn', { main: './out/m.js' }, ['out/m.js']))).toBe('./out/m.js')
    expect(entryFile(makePkg('@a/idx', {}, ['index.js']))).toBe('index.js')
  })

  it('读不到清单给 undefined', () => {
    expect(entryFile(path.join(tmp, 'node_modules', 'nope'))).toBeUndefined()
  })
})

describe('resolvePlugin', () => {
  const site = path.join(tmp, 'node_modules')

  it('查得到就给绝对路径', () => {
    makePkg('@a/ok', { exports: { '.': './lib/index.js' } }, ['lib/index.js'])
    expect(resolvePlugin('@a/ok', site)).toBe(path.join(site, '@a', 'ok', 'lib', 'index.js'))
  })

  it('包不在、入口文件不在,都给 undefined', () => {
    makePkg('@a/nofile', { exports: { '.': './lib/gone.js' } }, [])
    expect(resolvePlugin('@a/missing', site)).toBeUndefined()
    expect(resolvePlugin('@a/nofile', site)).toBeUndefined()
  })

  it('入口指到包目录外一律不认——那是越界,不是解析结果', () => {
    makePkg('@a/esc', { exports: { '.': '../../outside.js' } }, [])
    fs.writeFileSync(path.join(site, 'outside.js'), '')
    expect(resolvePlugin('@a/esc', site)).toBeUndefined()
  })
})
