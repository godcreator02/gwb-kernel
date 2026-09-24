import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { kernelSharedImports } from '../src/imports'

/**
 * 页面 importmap 的判据：只读内核包自己的清单，不起 electron、不起 cordis。
 * 夹具是手造的包目录：一份带 exports 与 gwb.shared 的清单，加上导出指到的文件
 */

const packageDirs: string[] = []
afterAll(() => {
  for (const dir of packageDirs) fs.rmSync(dir, { recursive: true, force: true })
})

/** 造一个临时包目录：files 是 相对路径 → 文本 的表，逐个写入磁盘，跑完统一清 */
function makePackageDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-imports-'))
  packageDirs.push(dir)
  for (const [rel, text] of Object.entries(files)) {
    const target = path.join(dir, rel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text)
  }
  return dir
}

const KERNEL_PACKAGE = '@godcreator/gwb-kernel-desktop'

describe('内核包声明的包名', () => {
  it('kernelSharedImports：按内核包自己的 exports 解析出真实文件', () => {
    const dir = makePackageDir({
      'package.json': JSON.stringify({ name: KERNEL_PACKAGE, exports: { './react': './dist/react.js' }, gwb: { shared: { react: './react' } } }),
      'dist/react.js': 'export default 1\n',
    })
    expect(kernelSharedImports(dir)).toEqual({ react: pathToFileURL(path.join(fs.realpathSync.native(dir), 'dist', 'react.js')).href })
  })

  it('kernelSharedImports：声明的文件不在就抛出——内核包本身不完整，不能带着缺了 react 的 importmap 启动', () => {
    const dir = makePackageDir({
      'package.json': JSON.stringify({ name: KERNEL_PACKAGE, exports: { './react': './dist/react.js' }, gwb: { shared: { react: './react' } } }),
    })
    expect(() => kernelSharedImports(dir)).toThrow()
  })

  it('本仓的内核包：react 的四个包名都声明了，exports 指到打包脚本产出的文件', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>
      gwb: { shared: Record<string, string> }
    }
    const script = fs.readFileSync(path.join(import.meta.dirname, '..', 'scripts', 'build-react.ts'), 'utf8')
    expect(Object.keys(manifest.gwb.shared).sort()).toEqual(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'])
    for (const subpath of Object.values(manifest.gwb.shared)) {
      const target = manifest.exports[subpath]
      expect(target).toMatch(/^\.\/dist\/react\/[a-z-]+\.js$/)
      expect(script).toContain(`out: '${path.basename(String(target))}'`)
    }
  })

  it('本仓的内核包：包根的 types 指向接口类型那份 d.ts，default 是内核入口', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
      main: string
      types: string
      exports: Record<string, unknown>
    }
    expect(manifest.exports['.']).toEqual({ types: './dist/api.d.ts', default: './dist/main.js' })
    expect(manifest.types).toBe('dist/api.d.ts')
    expect(manifest.main).toBe('dist/main.js')
  })
})
