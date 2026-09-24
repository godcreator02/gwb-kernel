import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import semver from 'semver'
import { afterEach, describe, expect, it } from 'vitest'
import { homePathFor as kernelHomePathFor } from '../../desktop/src/home-path.js'
import { KERNEL_PACKAGE, homePathFor, kernelEntryFor } from '../src/launch-plan.js'

const temporaryDirs: string[] = []

function makeTemporaryDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-launcher-'))
  temporaryDirs.push(dir)
  return dir
}

function writeKernelManifest(homeDir: string, manifest: unknown): string {
  const packageDir = path.join(homeDir, 'node_modules', ...KERNEL_PACKAGE.split('/'))
  fs.mkdirSync(packageDir, { recursive: true })
  fs.writeFileSync(path.join(packageDir, 'package.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest))
  return packageDir
}

function readManifest(relativeToTests: string): { version: string; engines?: { electron?: string }; devDependencies: Record<string, string> } {
  return JSON.parse(fs.readFileSync(path.join(import.meta.dirname, relativeToTests), 'utf8')) as ReturnType<typeof readManifest>
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('homePathFor', () => {
  it('和内核选 home 的规则逐个输入结果相同', () => {
    const appDataDir = makeTemporaryDir()
    for (const setting of ['default', 'kernel-in-home-2609241500', 'D:\\somewhere\\home', 'C:/a/b', './relative/home', '../up']) {
      expect(homePathFor(setting, appDataDir), setting).toBe(kernelHomePathFor(setting, appDataDir))
    }
  })
})

describe('kernelEntryFor', () => {
  it('home 里没有内核包：拒绝，说明是哪个 home、照 INSTALL.md 装', () => {
    const homeDir = makeTemporaryDir()
    const result = kernelEntryFor(homeDir, '44.1.1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain(homeDir)
    expect(result.message).toContain(KERNEL_PACKAGE)
    expect(result.message).toContain('INSTALL.md')
  })

  it('清单不是合法 JSON：拒绝，带上清单路径', () => {
    const homeDir = makeTemporaryDir()
    const packageDir = writeKernelManifest(homeDir, '{ not json')
    const result = kernelEntryFor(homeDir, '44.1.1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain(path.join(packageDir, 'package.json'))
  })

  it('没声明 engines.electron：拒绝', () => {
    const homeDir = makeTemporaryDir()
    writeKernelManifest(homeDir, { version: '0.3.0', main: 'dist/main.js' })
    const result = kernelEntryFor(homeDir, '44.1.1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('engines.electron')
  })

  it('当前 Electron 不在内核要求的范围里：拒绝，说出要求的范围与当前版本', () => {
    const homeDir = makeTemporaryDir()
    writeKernelManifest(homeDir, { version: '0.3.0', main: 'dist/main.js', engines: { electron: '^45.0.0' } })
    const result = kernelEntryFor(homeDir, '44.1.1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('^45.0.0')
    expect(result.message).toContain('44.1.1')
  })

  it('没有 main：拒绝', () => {
    const homeDir = makeTemporaryDir()
    writeKernelManifest(homeDir, { version: '0.3.0', engines: { electron: '^44.1.0' } })
    const result = kernelEntryFor(homeDir, '44.1.1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('main')
  })

  it('版本满足：给出内核包的入口文件', () => {
    const homeDir = makeTemporaryDir()
    const packageDir = writeKernelManifest(homeDir, { version: '0.3.0', main: 'dist/main.js', engines: { electron: '^44.1.0' } })
    expect(kernelEntryFor(homeDir, '44.1.1')).toEqual({ ok: true, entryFile: path.join(packageDir, 'dist', 'main.js') })
  })
})

describe('启动器与内核的 Electron 版本', () => {
  it('启动器带的 Electron 满足内核包声明的 engines.electron', () => {
    const launcher = readManifest('../package.json')
    const kernel = readManifest('../../desktop/package.json')
    const electronRange = kernel.engines?.electron
    expect(electronRange).toBeTypeOf('string')
    expect(semver.satisfies(launcher.devDependencies.electron ?? '', electronRange ?? '')).toBe(true)
  })
})
