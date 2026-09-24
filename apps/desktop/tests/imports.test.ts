import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { collectImports, kernelSharedImports } from '../src/imports'

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

const KERNEL_PACKAGE = '@godcreator/gwb-kernel-desktop'

/** 内核自己没给任何包名时的调用参数；内核优先的几条用例另给 kernelImports */
function importsOf(dataDir: string, warn: (msg: string) => void, kernelImports: Record<string, string> = {}): Record<string, string> {
  return collectImports({ dataDir, kernelImports, kernelPackageName: KERNEL_PACKAGE, warn })
}

function run(files: Record<string, string>, kernelImports: Record<string, string> = {}): { imports: Record<string, string>; warn: ReturnType<typeof vi.fn> } {
  const home = makeHome(files)
  const warn = vi.fn()
  return { imports: importsOf(home, warn, kernelImports), warn }
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
    const imports = importsOf(home, vi.fn())
    expect(imports['react']).toBe(pathToFileURL(path.join(fs.realpathSync.native(home), 'node_modules', 'shared-a', 'out.mjs')).href)
  })

  it('解析出的地址是包里那个文件的真实路径', () => {
    const home = makeHome({
      'package.json': homeManifest(['shared-a']),
      ...sharedPackage('shared-a', { react: './react.js' }, { './react.js': './out.mjs' }),
    })
    const imports = importsOf(home, vi.fn())
    expect(imports['react']).toBe(pathToFileURL(path.join(fs.realpathSync.native(home), 'node_modules', 'shared-a', 'out.mjs')).href)
  })

  it('撞名全部拒绝：该裸名不进表，第三个提供方到来时再 warn 一声', () => {
    const { imports, warn } = run({
      'package.json': homeManifest(['shared-a', 'shared-b', 'shared-c']),
      ...sharedPackage('shared-a', { react: './react.js' }, { './react.js': './out.mjs' }),
      ...sharedPackage('shared-b', { react: './react.js' }, { './react.js': './out.mjs' }),
      ...sharedPackage('shared-c', { react: './react.js' }, { './react.js': './out.mjs' }),
    })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0]?.[0])).toContain('shared-b')
    expect(String(warn.mock.calls[1]?.[0])).toContain('shared-c')
    expect(imports).toEqual({})
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

  it('junction 换指向后再算一遍拿到新版本：同一进程里不吃上一版的解析缓存', () => {
    // 照 pnpm 的真实布局造：node_modules/shared-v 是 junction，指到
    // .pnpm/shared-v@<版本>/node_modules/shared-v
    const layout = (version: string): Record<string, string> => ({
      [`.pnpm/shared-v@${version}/node_modules/shared-v/package.json`]: JSON.stringify({
        name: 'shared-v',
        exports: { './react.js': './out.mjs' },
        gwb: { shared: { react: './react.js' } },
      }),
      [`.pnpm/shared-v@${version}/node_modules/shared-v/out.mjs`]: 'export default 1\n',
    })
    const home = makeHome({ 'package.json': homeManifest(['shared-v']), ...layout('1.0.0'), ...layout('2.0.0') })
    const target = (version: string): string =>
      path.join(fs.realpathSync.native(home), '.pnpm', `shared-v@${version}`, 'node_modules', 'shared-v')
    const link = path.join(home, 'node_modules', 'shared-v')
    fs.mkdirSync(path.dirname(link), { recursive: true })
    fs.symlinkSync(target('1.0.0'), link, 'junction')
    const warn = vi.fn()
    expect(importsOf(home, warn)['react']).toBe(pathToFileURL(path.join(target('1.0.0'), 'out.mjs')).href)

    fs.rmSync(link, { force: true })
    fs.symlinkSync(target('2.0.0'), link, 'junction')
    expect(importsOf(home, warn)['react']).toBe(pathToFileURL(path.join(target('2.0.0'), 'out.mjs')).href)
    expect(warn).not.toHaveBeenCalled()
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

describe('内核给的包名', () => {
  const KERNEL_REACT = { react: 'file:///kernel/dist/react/react.js' }

  it('内核给了的包名：插件同名的声明忽略并 warn 一声，不算撞名，内核那份留着', () => {
    const { imports, warn } = run(
      {
        'package.json': homeManifest(['shared-a', 'shared-b']),
        ...sharedPackage('shared-a', { react: './react.js' }, { './react.js': './out.mjs' }),
        ...sharedPackage('shared-b', { react: './react.js', other: './react.js' }, { './react.js': './out.mjs' }),
      },
      KERNEL_REACT,
    )
    expect(imports['react']).toBe(KERNEL_REACT.react)
    expect(Object.keys(imports).sort()).toEqual(['other', 'react'])
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0]?.[0])).toContain('由内核提供')
  })

  it('home 清单里列着的内核包不再读一遍：它的声明已经在内核给的表里，不 warn', () => {
    const { imports, warn } = run(
      {
        'package.json': homeManifest([KERNEL_PACKAGE]),
        ...sharedPackage(KERNEL_PACKAGE, { react: './react.js' }, { './react.js': './out.mjs' }),
      },
      KERNEL_REACT,
    )
    expect(imports).toEqual(KERNEL_REACT)
    expect(warn).not.toHaveBeenCalled()
  })

  it('kernelSharedImports：按内核包自己的 exports 解析出真实文件', () => {
    const dir = makeHome({
      'package.json': JSON.stringify({ name: KERNEL_PACKAGE, exports: { './react': './dist/react.js' }, gwb: { shared: { react: './react' } } }),
      'dist/react.js': 'export default 1\n',
    })
    expect(kernelSharedImports(dir)).toEqual({ react: pathToFileURL(path.join(fs.realpathSync.native(dir), 'dist', 'react.js')).href })
  })

  it('kernelSharedImports：声明的文件不在就抛出——内核包本身不完整，不能带着缺了 react 的 importmap 启动', () => {
    const dir = makeHome({
      'package.json': JSON.stringify({ name: KERNEL_PACKAGE, exports: { './react': './dist/react.js' }, gwb: { shared: { react: './react' } } }),
    })
    expect(() => kernelSharedImports(dir)).toThrow()
  })

  it('本仓的内核包：react 的四个包名都声明了，exports 指到打包脚本产出的文件', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
      exports: Record<string, string>
      gwb: { shared: Record<string, string> }
    }
    const script = fs.readFileSync(path.join(import.meta.dirname, '..', 'scripts', 'build-react.ts'), 'utf8')
    expect(Object.keys(manifest.gwb.shared).sort()).toEqual(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'])
    for (const subpath of Object.values(manifest.gwb.shared)) {
      const target = manifest.exports[subpath]
      expect(target).toMatch(/^\.\/dist\/react\/[a-z-]+\.js$/)
      expect(script).toContain(`out: '${path.basename(target ?? '')}'`)
    }
  })
})
