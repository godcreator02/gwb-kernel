// 同一个服务名两个提供方：内置那份（根上下文直接 ctx.plugin）与 cordis.yml 条目那份（loader + include 加载）。
// 纯 node，不起 Electron、不碰任何 gwb home；临时 home 建在系统临时目录。装配照 apps/desktop/src/main.ts。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import { functionalProvider, serviceClassProvider } from './plugins/providers.mjs'
import { consumer } from './plugins/consumer.mjs'

const here = new URL('.', import.meta.url)
const ver = (p) => JSON.parse(fs.readFileSync(new URL(`node_modules/${p}/package.json`, here), 'utf8')).version
console.log(`node ${process.version} | cordis ${ver('cordis')} | plugin-loader ${ver('@cordisjs/plugin-loader')} | plugin-include ${ver('@cordisjs/plugin-include')}`)

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms))
const P = (globalThis.__probe = {
  counts: {}, seenLog: [],
  count(k) { this.counts[k] = (this.counts[k] ?? 0) + 1 },
  seen(who, source) { this.seenLog.push(`${who}←${source}`) },
  reset() { this.counts = {}; this.seenLog = [] },
})

const MAX_LINES = 8
const clip = (text) => {
  const lines = String(text).replaceAll(here.href, '<probe>/').split('\n')
  return lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `    …（其余 ${lines.length - MAX_LINES} 行略）`].join('\n') : text
}
let logLines = []
const flushLogs = () => { const out = logLines; logLines = []; return out }
process.on('unhandledRejection', (e) => logLines.push(`!! unhandledRejection: ${clip(e?.stack ?? e)}`))
process.on('uncaughtException', (e) => logLines.push(`!! uncaughtException: ${clip(e?.stack ?? e)}`))

const YML = `- id: cmd
  name: '@godcreator/gwb-commands'
- id: pm
  name: '@godcreator/gwb-plugin-manager'
- id: use-cmd
  name: probe-use-commands
- id: use-pm
  name: probe-use-plugin-manager
`
const YML_WITHOUT_DUPLICATES = `- id: use-cmd
  name: probe-use-commands
- id: use-pm
  name: probe-use-plugin-manager
`

const STATE = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']
const makeProvider = { fn: functionalProvider, class: serviceClassProvider }

function newWorld(kind, label) {
  P.reset(); flushLogs()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `probe-dup-svc-${label}-`))
  fs.writeFileSync(path.join(home, 'cordis.yml'), YML)
  const make = makeProvider[kind]
  const plugins = {
    builtinCommands: make('builtin-commands', 'gwbCommands', 'builtin'),
    builtinPluginManager: make('builtin-plugin-manager', 'gwbPluginManager', 'builtin', { contract: 1 }),
    byName: {
      '@godcreator/gwb-commands': make('yml-commands', 'gwbCommands', 'yml'),
      '@godcreator/gwb-plugin-manager': make('yml-plugin-manager', 'gwbPluginManager', 'yml', { contract: 1 }),
      'probe-use-commands': consumer('use-commands', 'gwbCommands'),
      'probe-use-plugin-manager': consumer('use-plugin-manager', 'gwbPluginManager'),
    },
  }
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(home + path.sep).href
  const Logger = ctx.logger('probe').constructor
  ctx.logger.exporter({
    levels: { default: 3 },
    export(m) { logLines.push(`[${m.type}] [${m.name}] ${clip(Logger.format({ colors: 0 }, m))}`) },
  })
  return { ctx, home, plugins, fibers: {} }
}

async function mountLoader(world) {
  const { ctx, plugins } = world
  await ctx.plugin(Loader, {})
  ctx.loader.internal = {
    async import(name) {
      const plugin = plugins.byName[name]
      if (!plugin) throw new Error(`probe: 没有名为 ${name} 的模块`)
      return { default: plugin }
    },
  }
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])
  await ctx.loader.await(); await settle()
}

async function mountBuiltins(world) {
  const { ctx, plugins, fibers } = world
  for (const [key, plugin] of [['builtinCommands', plugins.builtinCommands], ['builtinPluginManager', plugins.builtinPluginManager]]) {
    fibers[key] = ctx.plugin(plugin)
    try {
      await fibers[key]
      logLines.push(`-- await ctx.plugin(${key}) 正常返回`)
    } catch (e) {
      logLines.push(`-- await ctx.plugin(${key}) 抛出：${e?.message}`)
    }
  }
  await settle()
}

function fiberText(fiber) {
  if (!fiber) return 'none'
  return STATE[fiber.state] + (fiber._error ? `(${fiber._error.message})` : '')
}

function snapshot(world, title) {
  const { ctx, fibers } = world
  const entry = (id) => {
    try { return fiberText(ctx.loader.resolve(`home:${id}`).fiber) } catch { return 'removed' }
  }
  const service = (name) => {
    const impl = ctx.reflect._getImpl(name, false)
    return { value: ctx.get(name)?.source ?? 'undefined', providerFiber: impl ? `${impl.fiber.name}:${STATE[impl.fiber.state]}` : 'none' }
  }
  console.log(`\n--- ${title}`)
  console.log('builtin fibers :', JSON.stringify({ commands: fiberText(fibers.builtinCommands), pluginManager: fiberText(fibers.builtinPluginManager) }))
  if (ctx.loader) console.log('yml entries    :', JSON.stringify({ cmd: entry('cmd'), pm: entry('pm'), 'use-cmd': entry('use-cmd'), 'use-pm': entry('use-pm') }))
  console.log('services       :', JSON.stringify({ gwbCommands: service('gwbCommands'), gwbPluginManager: service('gwbPluginManager') }))
  console.log('counts         :', JSON.stringify(P.counts))
  console.log('consumer saw   :', P.seenLog.join(' | ') || '(none)')
  const logs = flushLogs()
  console.log('logs           :' + (logs.length ? '\n' + logs.map((l) => '  ' + l.replaceAll('\n', '\n  ')).join('\n') : ' (none)'))
}

const readYml = (world) => fs.readFileSync(path.join(world.home, 'cordis.yml'), 'utf8').trimEnd().replaceAll('\n', ' ⏎ ')

/** 承载 cordis.yml 的那棵条目树（include 实例），plugin-manager 删条目用的就是它：tree.remove(不带前缀的 id) */
const includeTree = (world) => world.ctx.loader.resolve('home').subtree

async function removeDuplicateEntries(world) {
  includeTree(world).remove('cmd')
  includeTree(world).remove('pm')
  await world.ctx.loader.await(); await settle(100)
}

// Q1–Q3：内置先 provide，cordis.yml 条目后 provide；再从条目树上 remove 掉重复条目
async function builtinFirstThenTreeRemove(kind) {
  console.log(`\n=== [${kind}] 内置先、yml 后；删重复条目用条目树的 remove ===`)
  const world = newWorld(kind, `${kind}-remove`)
  console.log('temp home      :', world.home)
  await mountBuiltins(world)
  snapshot(world, '1. 内置两份 ctx.plugin 之后、挂 loader 之前')
  await mountLoader(world)
  snapshot(world, '2. loader + include 读完 cordis.yml 之后')
  world.ctx.loader.remove('home:cmd')
  world.ctx.loader.remove('home:pm')
  await world.ctx.loader.await(); await settle(100)
  snapshot(world, '3a. 在 loader 根树上 ctx.loader.remove("home:cmd") / ("home:pm") 之后（带前缀的 id）')
  console.log('cordis.yml now :', readYml(world))
  await removeDuplicateEntries(world)
  snapshot(world, '3b. 在 include 那棵树上 remove("cmd") / remove("pm") 之后（不带前缀的 id）')
  console.log('cordis.yml now :', readYml(world))
}

// Q3 另一种删法：直接改 yml，再让 include 重新读（include 1.0.5 不监视文件，重新读要调它的 refresh()）
async function builtinFirstThenYmlEdit(kind) {
  console.log(`\n=== [${kind}] 内置先、yml 后；删重复条目用改 yml + include.refresh() ===`)
  const world = newWorld(kind, `${kind}-refresh`)
  console.log('temp home      :', world.home)
  await mountBuiltins(world)
  await mountLoader(world)
  snapshot(world, '1. 内置 + loader 都挂完')
  fs.writeFileSync(path.join(world.home, 'cordis.yml'), YML_WITHOUT_DUPLICATES)
  const changed = await includeTree(world).refresh()
  await world.ctx.loader.await(); await settle(100)
  console.log('refresh() 返回 :', changed)
  snapshot(world, '2. 改 yml 去掉 cmd / pm 条目、include.refresh() 之后')
}

// Q4：顺序反过来，先挂 loader 读 cordis.yml，再 ctx.plugin 内置那份
async function ymlFirstThenBuiltin(kind) {
  console.log(`\n=== [${kind}] yml 先、内置后 ===`)
  const world = newWorld(kind, `${kind}-reverse`)
  console.log('temp home      :', world.home)
  await mountLoader(world)
  snapshot(world, '1. loader + include 读完 cordis.yml 之后')
  await mountBuiltins(world)
  snapshot(world, '2. 再 ctx.plugin 内置两份之后')
  await removeDuplicateEntries(world)
  snapshot(world, '3. 在 include 那棵树上 remove 掉 cmd / pm 之后')
  await world.fibers.builtinCommands.dispose()
  await world.fibers.builtinPluginManager.dispose()
  await settle()
  await mountBuiltins(world)
  snapshot(world, '4. 把 FAILED 的内置 fiber dispose 掉、重新 ctx.plugin 之后')
}

for (const kind of ['fn', 'class']) {
  await builtinFirstThenTreeRemove(kind)
  await builtinFirstThenYmlEdit(kind)
  await ymlFirstThenBuiltin(kind)
}
await settle(200)
const tail = flushLogs()
if (tail.length) console.log('\n--- 结尾残留日志\n' + tail.join('\n'))
