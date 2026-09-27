// 条目 fiber 的状态什么时候变、internal/status 什么时候发：同步 / 异步 apply、抛错、等服务、嵌套插件、import 失败，以及停用、启用、改配置、删掉服务提供方。
// 纯 node，不起 Electron、不碰任何 gwb home；临时 home 建在系统临时目录。装配照 apps/desktop/src/main.ts，只多开了 include 的 enableLogs。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import {
  AsyncService,
  asyncFailPlugin,
  asyncPlugin,
  needsNobodyPlugin,
  needsServicePlugin,
  nestedPlugin,
  syncFailPlugin,
  syncPlugin,
} from './plugins.mjs'

const here = new URL('.', import.meta.url)
const versionOf = (pkg) => JSON.parse(fs.readFileSync(new URL(`node_modules/${pkg}/package.json`, here), 'utf8')).version
console.log(`node ${process.version} | cordis ${versionOf('cordis')} | plugin-loader ${versionOf('@cordisjs/plugin-loader')} | plugin-include ${versionOf('@cordisjs/plugin-include')}`)

const startedAt = performance.now()
const elapsed = () => String(Math.round(performance.now() - startedAt)).padStart(5)
const MAX_STACK_LINES = 6
const clip = (text) => String(text).split('\n').slice(0, MAX_STACK_LINES).join(' ⏎ ')
const mark = (text) => console.log(`${elapsed()}ms  ${text}`)
globalThis.__probe = { mark }

process.on('unhandledRejection', (e) => mark(`!! unhandledRejection: ${clip(e?.stack ?? e)}`))
process.on('uncaughtException', (e) => mark(`!! uncaughtException: ${clip(e?.stack ?? e)}`))

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pluginsByName = {
  'probe-sync': syncPlugin,
  'probe-async': asyncPlugin,
  'probe-sync-fail': syncFailPlugin,
  'probe-async-fail': asyncFailPlugin,
  'probe-svc-async': AsyncService,
  'probe-needs-svc': needsServicePlugin,
  'probe-needs-nobody': needsNobodyPlugin,
  'probe-nested': nestedPlugin,
}

const YML = `- id: sync
  name: probe-sync
  config: { v: 1 }
- id: async
  name: probe-async
- id: sync-fail
  name: probe-sync-fail
- id: async-fail
  name: probe-async-fail
- id: svc
  name: probe-svc-async
- id: needs-svc
  name: probe-needs-svc
- id: needs-nobody
  name: probe-needs-nobody
- id: nested
  name: probe-nested
- id: missing
  name: probe-not-installed
`

// FiberState 的数字顺序，照 cordis lib/index.js 的 const enum
const STATE = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

/**
 * 这个 fiber 是不是某个条目的顶层 fiber：插件里再 ctx.plugin 出来的子 fiber 也带着同一个 entry。
 * 两个判据都打出来：loader 自己用的「父 fiber 不属于同一个条目」，与「entry.fiber 就是它」
 */
function fiberLabel(fiber) {
  const entry = fiber.entry
  if (entry === undefined) return `${fiber.name}（不属于条目）`
  const role = fiber.parent.fiber?.entry === entry ? '子 fiber' : '条目顶层'
  return `${fiber.name}（条目 ${entry.options.id}，${role}，entry.fiber===fiber:${entry.fiber === fiber}）`
}

function stateOfEntry(ctx, id) {
  const entry = ctx.loader.resolve(`home:${id}`)
  if (entry === undefined) return 'removed'
  if (entry.disabled) return 'disabled'
  if (entry.fiber === undefined) return 'no fiber'
  const error = entry.fiber._error
  return STATE[entry.fiber.state] + (error ? `（${clip(error.message)}）` : '')
}

function printEntryStates(ctx, title) {
  const ids = [...ctx.loader.resolve('home').subtree.entries()].map((entry) => entry.options.id)
  mark(`== ${title}：${ids.map((id) => `${id}=${stateOfEntry(ctx, id)}`).join('  ')}`)
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-entry-state-'))
fs.writeFileSync(path.join(home, 'cordis.yml'), YML)
console.log(`temp home: ${home}\n`)

const ctx = new Context()
ctx.baseUrl = pathToFileURL(home + path.sep).href
const Logger = ctx.logger('probe').constructor
const logExporter = {
  colors: 0,
  levels: { default: 3 },
  export(message) {
    mark(`log [${message.type}] [${message.name}] ${clip(Logger.format(logExporter, message))}`)
    const [first] = message.args ?? []
    if (first instanceof Error) mark(`    ↑ 第一个参数是 Error：message=${JSON.stringify(first.message)}，stack 第一行=${JSON.stringify(String(first.stack).split('\n')[0])}`)
  },
}
ctx.logger.exporter(logExporter)
ctx.on('internal/status', (fiber, oldState) => mark(`status ${fiberLabel(fiber)}：${STATE[oldState]} → ${STATE[fiber.state]}`))

await ctx.plugin(Loader, {})
ctx.loader.internal = {
  async import(name) {
    const plugin = pluginsByName[name]
    if (plugin === undefined) throw new Error(`probe: 没有名为 ${name} 的模块`)
    return { default: plugin }
  },
}
ctx.loader.builtins.include = Include

mark('--- 1. 启动加载：root.update 读 cordis.yml')
await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml', enableLogs: true } }])
mark('--- root.update 返回')
await ctx.loader.await()
mark('--- ctx.loader.await() 返回')
printEntryStates(ctx, 'loader.await() 返回时')
await settle(800)
printEntryStates(ctx, '再等 800ms')

const tree = ctx.loader.resolve('home').subtree

async function step(title, change) {
  console.log('')
  mark(`--- ${title}`)
  await change()
  mark('--- 改动的 promise 返回')
  await ctx.loader.await()
  mark('--- ctx.loader.await() 返回')
  await settle(600)
  printEntryStates(ctx, '再等 600ms')
}

await step('2. 停用 async（tree.update(id, { disabled: true })，plugin-manager 的停用就是这样）', () => tree.update('async', { disabled: true }))
await step('3. 启用 async（tree.update(id, { disabled: null })）', () => tree.update('async', { disabled: null }))
await step('4. 改 sync 的配置（tree.update(id, { config: { v: 2 } })）', () => tree.update('sync', { config: { v: 2 } }))
await step('5. 删掉服务提供方 svc（tree.remove）', async () => tree.remove('svc'))
await step('6. 再加回一条 probe-svc-async（tree.create）', () => tree.create({ name: 'probe-svc-async' }))

await settle(300)
