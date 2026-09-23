// 问题与结论见 README.md。纯 node，不启动 electron，不碰任何 gwb home：临时 home 建在系统临时目录
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context, FiberState } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'

const report = (step, fields) => console.log(JSON.stringify({ step, ...fields }))
const tick = () => new Promise((resolve) => setTimeout(resolve, 20))
const stateOf = (entry) => (entry?.fiber ? FiberState[entry.fiber.state] : 'no-fiber')

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-tree-probe-'))
fs.writeFileSync(path.join(home, 'cordis.yml'), '- id: alpha\n  name: alpha\n')

/** cordis.yml 里的插件：记下自己从条目上取到的那棵树（插件管理今天的取法） */
let alphaSawTree
const modules = {
  alpha: {
    name: 'alpha',
    apply(ctx) {
      alphaSawTree = ctx.fiber.entry?.parent.tree
    },
  },
  gamma: { name: 'gamma', apply() {} },
}

const errors = []
process.on('unhandledRejection', (err) => errors.push(`unhandledRejection: ${String(err)}`))

// 照 main.ts 的顺序搭环境
const ctx = new Context()
ctx.baseUrl = pathToFileURL(home + path.sep).href
const loaderFiber = await ctx.plugin(Loader, {})
ctx.loader.internal = {
  import: async (name) => {
    const found = modules[name]
    if (found === undefined) throw new Error(`实验里没有包 ${name}`)
    return found
  },
}
ctx.loader.builtins.include = Include
await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])

// 一：root.update 返回之后、loader.await() 之前，从 loader 上能不能取到 include 那棵树
const homeEntry = ctx.loader.resolve('home')
const earlyTree = homeEntry.subtree
report('1-after-root-update', {
  homeEntryState: stateOf(homeEntry),
  subtreeDefined: earlyTree !== undefined,
  subtreeIsInclude: earlyTree instanceof Include,
  storeKeys: earlyTree ? Object.keys(earlyTree.store) : null,
})

// 二：内核用 ctx.plugin 直接加载的「内置插件」，把树经 config 传进去；它自己的 fiber 上没有 entry
let builtinGot
let builtinEntry
await ctx.plugin(
  {
    name: 'builtin-plugin-manager',
    apply(inner, config) {
      builtinGot = config.tree
      builtinEntry = inner.fiber.entry
    },
  },
  { tree: earlyTree },
)
await ctx.loader.await()
const alphaEntry = earlyTree.resolve('alpha')
report('2-after-loader-await', {
  storeKeys: Object.keys(earlyTree.store),
  alpha: stateOf(alphaEntry),
  alphaEntryId: alphaEntry.id,
  sameTreeAsAlphaSees: alphaSawTree === earlyTree,
  builtinGotSameTree: builtinGot === earlyTree,
  builtinHasOwnEntry: builtinEntry !== undefined,
  subtreeStillSame: ctx.loader.resolve('home').subtree === earlyTree,
})

// 三：内置插件拿到的树能照常改 cordis.yml：加一条、停用、启用、删一条
const tree = builtinGot
const createdId = await tree.create({ id: 'gamma', name: 'gamma' }, null)
await ctx.loader.await()
await tick()
report('3a-create', { createdId, gamma: stateOf(tree.resolve('gamma')), yml: fs.readFileSync(path.join(home, 'cordis.yml'), 'utf8') })

await tree.update('alpha', { disabled: true })
await ctx.loader.await()
await tick()
report('3b-disable', { alpha: stateOf(tree.resolve('alpha')), yml: fs.readFileSync(path.join(home, 'cordis.yml'), 'utf8') })

await tree.update('alpha', { disabled: null })
await ctx.loader.await()
await tick()
report('3c-enable', { alpha: stateOf(tree.resolve('alpha')), yml: fs.readFileSync(path.join(home, 'cordis.yml'), 'utf8') })

tree.remove('gamma')
await ctx.loader.await()
await tick()
report('3d-remove', { storeKeys: Object.keys(tree.store), yml: fs.readFileSync(path.join(home, 'cordis.yml'), 'utf8') })

// 四：cordis.yml 在外面被改、include 重新读之后，树还是同一个对象
fs.writeFileSync(path.join(home, 'cordis.yml'), '- id: alpha\n  name: alpha\n- id: gamma\n  name: gamma\n')
await tree.refresh()
await ctx.loader.await()
report('4-after-refresh', {
  subtreeStillSame: ctx.loader.resolve('home').subtree === tree,
  storeKeys: Object.keys(tree.store),
  gamma: stateOf(tree.resolve('gamma')),
})

await loaderFiber.dispose()
await loaderFiber.await()
await tick()
report('done', { home, errors })
