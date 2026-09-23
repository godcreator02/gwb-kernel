import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context, type Fiber } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import { asTree, type EntryTreeLike } from '../src/tree'
import { readEntries } from '../src/inventory'
import { remountEntry } from '../src/remount'

/**
 * plugin-manager 依赖 loader 没有写进文档的内部结构：内核取 `ctx.loader.resolve('home').subtree` 经 config 交来条目树，
 * 插件管理用它的 create / update / remove / resolve 改 `cordis.yml`，从 `store` 读条目。这组测试用**内核实际使用的
 * loader 与 include 版本**、照内核的加载顺序搭一个相同的环境（根上下文指向 home、include 读 cordis.yml、
 * 取树交给直接加载的插件），把这些用法都跑一遍。内核升级 loader 时，这里会先失败。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const readJson = (file: string): Record<string, Record<string, string>> =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, string>>

describe('loader 版本和内核一致', () => {
  it('plugin-loader、plugin-include、cordis 的版本与 apps/desktop 写的完全相同', () => {
    const kernel = readJson(path.resolve(here, '../../../apps/desktop/package.json'))['dependencies']!
    const own = readJson(path.resolve(here, '../package.json'))['devDependencies']!
    for (const pkg of ['@cordisjs/plugin-loader', '@cordisjs/plugin-include', 'cordis']) {
      expect(own[pkg], pkg).toBe(kernel[pkg])
    }
  })
})

/** 直接加载的插件从 config 里拿到的东西 */
interface Received {
  tree: EntryTreeLike
  /** 它自己的 fiber 上有没有条目：内核直接加载的插件没有 */
  hasOwnEntry: boolean
}

type LoaderLike = Record<string, unknown> & {
  builtins: Record<string, unknown>
  resolve(id: string): { subtree?: unknown }
}

let homeDir = ''
let loaderFiber: Fiber | undefined

afterEach(async () => {
  if (loaderFiber !== undefined) {
    await loaderFiber.dispose()
    await loaderFiber.await()
    loaderFiber = undefined
    // 卸载时 include 还会把 cordis.yml 写回一次（推迟到下一个宏任务），等它写完再删目录
    await flushWrite()
  }
  if (homeDir !== '') fs.rmSync(homeDir, { recursive: true, force: true })
  homeDir = ''
})

/**
 * 照内核 main.ts 的顺序搭环境：根上下文指向 home → 注册 loader → 替它解析包名 → include 读 cordis.yml →
 * 取 `resolve('home').subtree` 经 config 交给直接加载的插件 → 等 cordis.yml 里的插件加载完
 */
async function boot(yml: string, modules: Record<string, unknown>): Promise<Received> {
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-loader-'))
  fs.writeFileSync(path.join(homeDir, 'cordis.yml'), yml)
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(homeDir + path.sep).href
  loaderFiber = await ctx.plugin(Loader, {})
  const loader = (ctx as unknown as { loader: LoaderLike }).loader
  loader['internal'] = {
    import: async (name: string) => {
      const found = modules[name]
      if (found === undefined) throw new Error(`测试里没有包 ${name}`)
      return found
    },
  }
  loader.builtins['include'] = Include
  const root = loader['root'] as { update(entries: unknown[]): Promise<void> }
  await root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])

  let received: Received | undefined
  const builtin = {
    name: 'builtin',
    apply: (inner: Context, config: { tree: unknown }) => {
      received = { tree: asTree(config.tree), hasOwnEntry: inner.fiber.entry !== undefined }
    },
  }
  await ctx.plugin(builtin, { tree: loader.resolve('home').subtree })
  await (loader['await'] as () => Promise<void>).call(loader)
  if (received === undefined) throw new Error('直接加载的插件没有运行')
  return received
}

/** include 把写回 cordis.yml 推迟到下一个宏任务，读文件之前先等一下 */
const flushWrite = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50))
const readYml = (): string => fs.readFileSync(path.join(homeDir, 'cordis.yml'), 'utf8')

describe('真实的 loader 条目树', () => {
  it('内核取到的树经 config 交给直接加载的插件，cordis.yml 里的条目都在上面', async () => {
    const other = { name: 'other', apply: () => undefined }
    const received = await boot('- id: other\n  name: other\n', { other })
    expect(received.hasOwnEntry).toBe(false)
    expect(Object.keys(received.tree.store)).toContain('other')
  })

  it('create、update、remove 改的是内存里的条目，也写回 cordis.yml', async () => {
    const other = { name: 'other', apply: () => undefined }
    const { tree } = await boot('[]\n', { other })

    const created = tree.create({ id: 'other', name: 'other' }, null)
    // create 在第一个 await 之前就把条目放进 store，条目上的 id 带着前缀：插件管理不等加载完就从这里读完整 entryId
    expect((tree.store['other'] as { id: string }).id).toBe('home:other')
    expect(await created).toBe('home:other')
    const entries = readEntries(tree.store)
    expect(entries.map((entry) => entry.pkg)).toContain('other')
    await flushWrite()
    expect(readYml()).toMatch(/name: other/)

    await tree.update('other', { disabled: true })
    await flushWrite()
    expect(readYml()).toMatch(/disabled: true/)

    tree.remove('other')
    await flushWrite()
    expect(readYml()).not.toMatch(/name: other/)
    expect(Object.keys(tree.store)).not.toContain('other')
  })

  it('停用再启用会重新加载，最后是 ACTIVE', async () => {
    let applied = 0
    const other = { name: 'other', apply: () => { applied += 1 } }
    const { tree } = await boot('- id: other\n  name: other\n', { other })
    expect(applied).toBe(1)

    const state = await remountEntry(tree, 'other', 2000)
    expect(state).toBe('ACTIVE')
    expect(applied).toBe(2)
  })
})
