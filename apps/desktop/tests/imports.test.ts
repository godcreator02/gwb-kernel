import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { collectImports } from '../src/imports'

/**
 * collectImports 的判据：不起 electron、不起 cordis，只喂一个临时 home 目录看输出。
 * 夹具全部手造——共享包不是真装的，只是 node_modules 里一份带 exports 与 gwb.shared 的清单
 */

const homes: string[] = []
afterAll(() => {
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true })
})

/** 造一个临时 home：files 是 相对路径 → 文本 的表，逐个落盘，跑完统一清 */
function makeHome(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-imports-'))
  homes.push(dir)
  for (const [rel, text] of Object.entries(files)) {
    const target = path.join(dir, rel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text)
  }
  return dir
}

/** 一个共享包夹具：清单带 exports 与 gwb.shared，导出的目标文件也落盘 */
function sharedPackage(pkg: string, shared: unknown, exports: Record<string, string> = {}): Record<string, string> {
  return {
    [`node_modules/${pkg}/package.json`]: JSON.stringify({ name: pkg, exports, gwb: { shared } }),
    [`node_modules/${pkg}/out.mjs`]: 'export default 1\n',
  }
}

function run(files: Record<string, string>): { imports: Record<string, string>; warn: ReturnType<typeof vi.fn> } {
  const home = makeHome(files)
  const warn = vi.fn()
  return { imports: collectImports({ dataDir: home, warn }), warn }
}

const homeManifest = (deps: string[]): string => JSON.stringify({ dependencies: Object.fromEntries(deps.map((d) => [d, '1.0.0'])) })

describe('collectImports', () => {
  it('没有包清单就是空表，一声不吭', () => {
    const { imports, warn } = run({})
    expect(imports).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  it('清单里没有依赖也是空表', () => {
    const { imports, warn } = run({ 'package.json': '{\n  "name": "gwb-home"\n}\n' })
    expect(imports).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  it('声明得对就收进 file:// 表：exports 子路径解出真实文件', () => {
    const { imports, warn } = run({
      'package.json': homeManifest(['shared-a']),
      ...sharedPackage('shared-a', { react: './react.js' }, { './react.js': './out.mjs' }),
    })
    expect(warn).not.toHaveBeenCalled()
    expect(Object.keys(imports)).toEqual(['react'])
  })

  it('子路径不带 ./ 前缀也一样解析到那个文件', () => {
    const home = makeHome({
      'package.json': homeManifest(['shared-a']),
      ...sharedPackage('shared-a', { react: 'react.js' }, { './react.js': './out.mjs' }),
    })
    const imports = collectImports({ dataDir: home, warn: vi.fn() })
    expect(imports['react']).toBe(pathToFileURL(path.join(home, 'node_modules', 'shared-a', 'out.mjs')).href)
  })

  it('解析出的地址指向包里那个文件', () => {
    const home = makeHome({
      'package.json': homeManifest(['shared-a']),
      ...sharedPackage('shared-a', { react: './react.js' }, { './react.js': './out.mjs' }),
    })
    const imports = collectImports({ dataDir: home, warn: vi.fn() })
    expect(imports['react']).toBe(pathToFileURL(path.join(home, 'node_modules', 'shared-a', 'out.mjs')).href)
  })

  it('撞名只认先到的，后来那条 warn 一声', () => {
    const { imports, warn } = run({
      'package.json': homeManifest(['shared-a', 'shared-b']),
      ...sharedPackage('shared-a', { react: './react.js' }, { './react.js': './out.mjs' }),
      ...sharedPackage('shared-b', { react: './react.js' }, { './react.js': './out.mjs' }),
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('shared-b')
    expect(Object.keys(imports)).toEqual(['react'])
  })

  it('exports 里没有那个子路径：不收，warn 带原话', () => {
    const { imports, warn } = run({
      'package.json': homeManifest(['shared-a']),
      ...sharedPackage('shared-a', { react: './react.js' }),
    })
    expect(imports).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('解析不到')
  })

  it('坏形状一律静默忽略：shared 非对象、裸名空串、子路径非字符串或空串、包没声明 gwb、包根本不在', () => {
    const { imports, warn } = run({
      'package.json': homeManifest(['str-shared', 'empty-bare', 'bad-sub', 'empty-sub', 'no-gwb', 'ghost']),
      ...sharedPackage('str-shared', 'react'),
      ...sharedPackage('empty-bare', { '': './react.js' }),
      ...sharedPackage('bad-sub', { react: 1 }),
      ...sharedPackage('empty-sub', { react: '' }),
      ...sharedPackage('no-gwb', undefined),
    })
    expect(imports).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })
})
