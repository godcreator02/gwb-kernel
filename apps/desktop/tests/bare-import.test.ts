import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { bareImportFromHome } from '../src/bare-import'

/**
 * 包名 import 的判据：不启动 electron 与 cordis，只给一个临时 home 目录看行为。
 * 夹具全部手写——包不是真装的，只是 node_modules 里一份带 exports 的清单加实现文件
 */

const homes: string[] = []
afterAll(() => {
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true })
})

/** 建一个临时 home：files 是「相对路径 → 文本」的表，逐个写进磁盘，全部用例结束后统一删除 */
function makeHome(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-bare-'))
  homes.push(dir)
  for (const [rel, text] of Object.entries(files)) {
    const target = path.join(dir, rel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text)
  }
  return dir
}

/** 一个插件形状的夹具包：清单带 exports，实现文件导出 mark */
function fixturePackage(name: string, mark: string): Record<string, string> {
  return {
    [`node_modules/${name}/package.json`]: JSON.stringify({ name, type: 'module', exports: { '.': './index.mjs' } }),
    [`node_modules/${name}/index.mjs`]: `export const mark = ${JSON.stringify(mark)}\n`,
  }
}

describe('bareImportFromHome', () => {
  it('裸名解析并 import 成功：exports 的主入口进来，读得到导出', async () => {
    const home = makeHome({ ...fixturePackage('gwb-fixture-a', 'a') })
    const ns = (await bareImportFromHome(home)('gwb-fixture-a')) as { mark: string }
    expect(ns.mark).toBe('a')
  })

  it('scoped 名字落在 node_modules 的 scope 层目录里，一样解析得到', async () => {
    const home = makeHome({ ...fixturePackage('@gwb/fixture', 'scoped') })
    const ns = (await bareImportFromHome(home)('@gwb/fixture')) as { mark: string }
    expect(ns.mark).toBe('scoped')
  })

  it('junction 换指向后拿到新版本：realpath 绕开 CJS 解析缓存，运行中换版本重新加载靠这一步', async () => {
    // 照 pnpm 的真实布局：node_modules/current 是 junction，指向
    // .pnpm/current@<版本>/node_modules/current——从真实目录起 resolve 时在版本目录里
    // 就找到自己，不再碰 junction，每版的缓存键天然不同
    const layout = (version: string, mark: string): Record<string, string> => ({
      [`.pnpm/current@${version}/node_modules/current/package.json`]: JSON.stringify({
        name: 'current',
        type: 'module',
        exports: { '.': './index.mjs' },
      }),
      [`.pnpm/current@${version}/node_modules/current/index.mjs`]: `export const mark = ${JSON.stringify(mark)}\n`,
    })
    const home = makeHome({ ...layout('1.0.0', 'v1'), ...layout('2.0.0', 'v2') })
    const link = path.join(home, 'node_modules', 'current')
    fs.mkdirSync(path.dirname(link), { recursive: true })
    fs.symlinkSync(path.join(home, '.pnpm', 'current@1.0.0', 'node_modules', 'current'), link, 'junction')
    const importBare = bareImportFromHome(home)
    expect(((await importBare('current')) as { mark: string }).mark).toBe('v1')

    fs.rmSync(link, { force: true })
    expect(fs.existsSync(path.join(home, '.pnpm', 'current@1.0.0', 'node_modules', 'current'))).toBe(true) // 删 junction 不伤目标
    fs.symlinkSync(path.join(home, '.pnpm', 'current@2.0.0', 'node_modules', 'current'), link, 'junction')
    expect(((await importBare('current')) as { mark: string }).mark).toBe('v2')
  })

  it('裸名不存在时拒绝，ENOENT 带着裸名那条 node_modules 路径', async () => {
    const home = makeHome({})
    // realpath 是同步抛的，套一层 async 才接得住成 rejection
    const attempt = async (): Promise<unknown> => bareImportFromHome(home)('ghost-pkg')
    await expect(attempt()).rejects.toThrow(/node_modules.*ghost-pkg/)
  })
})
