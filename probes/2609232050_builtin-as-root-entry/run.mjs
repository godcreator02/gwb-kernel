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
const stateOf = (fiber) => (fiber ? FiberState[fiber.state] : 'no-fiber')

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-root-entry-probe-'))
// 已有 home 里残留的旧条目：cmd、pm 提供同名服务；use-cmd 依赖命令总线；plain 是普通插件
fs.writeFileSync(
  path.join(home, 'cordis.yml'),
  '- id: cmd\n  name: old-commands\n- id: pm\n  name: old-plugin-manager\n- id: use-cmd\n  name: use-commands\n- id: plain\n  name: plain\n',
)

const errors = []
process.on('unhandledRejection', (err) => errors.push(`unhandledRejection: ${String(err)}`))

/** 按调用方的条目认身份的服务，照数据插件与说明书插件的做法：取不到条目就抛 */
class IdentityService {
  constructor(ctx) {
    this.ctx = ctx
  }
  whoami() {
    const entry = this.ctx.fiber.entry
    if (entry === undefined) throw new Error('取不到调用方的身份')
    return entry.id
  }
}

const seen = {}
const provider = (service, label) => ({
  name: label,
  apply(ctx) {
    ctx.effect(() => ctx.provide(service, { from: label }))
  },
})
const modules = {
  'old-commands': provider('gwbCommands', 'old-commands'),
  'old-plugin-manager': provider('gwbPluginManager', 'old-plugin-manager'),
  'use-commands': {
    name: 'use-commands',
    inject: ['gwbCommands'],
    apply(ctx) {
      seen.useCommandsGot = ctx.gwbCommands.from
    },
  },
  plain: { name: 'plain', apply() {} },
  gamma: { name: 'gamma', apply() {} },
}

class Marker {
  constructor() {
    this.value = 1
  }
  method() {
    return 'method'
  }
}

const builtinCommands = {
  name: 'builtin-commands',
  apply(ctx) {
    ctx.effect(() => ctx.provide('gwbCommands', { from: 'builtin' }))
    seen.commandsEntryId = ctx.fiber.entry?.id
    seen.commandsIdentity = new IdentityService(ctx).whoami()
  },
}
const builtinPluginManager = {
  name: 'builtin-plugin-manager',
  apply(ctx, config) {
    ctx.effect(() => ctx.provide('gwbPluginManager', { from: 'builtin' }))
    seen.pmEntryId = ctx.fiber.entry?.id
    seen.pmIdentity = new IdentityService(ctx).whoami()
    seen.pmConfigPnpm = config.pnpm
    seen.pmConfigHome = config.home
    seen.markerKeptMethod = typeof config.marker?.method === 'function'
    // 条目树：从自己条目所在的那一层，按 config 给的条目 id 取 include 那棵树；apply 时可能还没建好，所以用到时再取
    const parentTree = ctx.fiber.entry?.parent.tree
    seen.treeAt = () => parentTree?.resolve(config.home).subtree
    seen.treeAtApply = seen.treeAt() !== undefined
  },
}

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
ctx.loader.builtins['gwb-commands'] = builtinCommands
ctx.loader.builtins['gwb-plugin-manager'] = builtinPluginManager

// 内置插件作为 loader 根层的条目，都排在承载 cordis.yml 的 include 条目之前（ORDER=after 时插件管理排在后面，对照用）
const pluginManagerEntry = { id: 'plugin-manager', name: 'cordis:gwb-plugin-manager', config: { home: 'home', pnpm: 'C:\\x\\pnpm.exe', marker: new Marker() } }
const includeEntry = { id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }
const order = process.env.ORDER === 'after' ? [includeEntry, pluginManagerEntry] : [pluginManagerEntry, includeEntry]
report('0-order', { order: ['commands', ...order.map((e) => e.id)] })
await ctx.loader.root.update([{ id: 'commands', name: 'cordis:gwb-commands' }, ...order])
await ctx.loader.await()
await tick()

const homeTree = ctx.loader.resolve('home').subtree
report('1-root-entries', {
  commands: stateOf(ctx.loader.resolve('commands').fiber),
  pluginManager: stateOf(ctx.loader.resolve('plugin-manager').fiber),
  commandsEntryId: seen.commandsEntryId,
  commandsIdentity: seen.commandsIdentity,
  pmEntryId: seen.pmEntryId,
  pmIdentity: seen.pmIdentity,
  pmConfigPnpm: seen.pmConfigPnpm,
  pmConfigHome: seen.pmConfigHome,
  markerKeptMethod: seen.markerKeptMethod,
  treeAtApply: seen.treeAtApply,
  lazyTreeIsIncludeTree: seen.treeAt() === homeTree,
})

report('2-leftover-entries', {
  cmd: stateOf(homeTree.resolve('cmd').fiber),
  pm: stateOf(homeTree.resolve('pm').fiber),
  useCmd: stateOf(homeTree.resolve('use-cmd').fiber),
  plain: stateOf(homeTree.resolve('plain').fiber),
  useCommandsGot: seen.useCommandsGot,
  gwbCommandsIs: ctx.get('gwbCommands')?.from,
  gwbPluginManagerIs: ctx.get('gwbPluginManager')?.from,
})

// 用取到的树改 cordis.yml：加一条再删掉
const tree = seen.treeAt()
const created = await tree.create({ id: 'gamma', name: 'gamma' }, null)
await ctx.loader.await()
await tick()
const afterCreate = fs.readFileSync(path.join(home, 'cordis.yml'), 'utf8')
tree.remove('gamma')
await ctx.loader.await()
await tick()
report('3-edit-cordis-yml', {
  created,
  ymlHasGamma: afterCreate.includes('gamma'),
  ymlAfterRemove: fs.readFileSync(path.join(home, 'cordis.yml'), 'utf8'),
  rootEntriesInYml: afterCreate.includes('cordis:gwb-'),
})

report('4-loader-entries', { ids: [...ctx.loader.entries()].map((e) => e.id) })

await loaderFiber.dispose()
await loaderFiber.await()
await tick()
report('done', { home, errors: errors.map((e) => e.slice(0, 160)) })
