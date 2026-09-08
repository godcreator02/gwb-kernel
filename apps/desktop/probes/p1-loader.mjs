// 探针一：cordis 住主进程，loader 不带 --expose-internals，内核自己塞一个 internal 按 home 解析裸名。
// 断言：(1) loader.internal 原本是 undefined；(2) 塞进去之后 home 里的裸名件真的挂上（fiber 活着 + 件留下的记号）。
// 结果写到 probes/p1-loader.out.json，不靠 GUI 进程的 stdout。
import electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'

const { app } = electron
const here = path.dirname(fileURLToPath(import.meta.url))
const home = path.resolve(here, 'homes', 'probe1')
const outFile = path.join(here, 'p1-loader.out.json')
const out = { execArgv: process.execArgv, node: process.versions.node, electron: process.versions.electron, log: [] }

function finish(extra) {
  Object.assign(out, extra)
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
  app.exit(0)
}

const ctx = new Context()
ctx.baseUrl = pathToFileURL(home + path.sep).href
ctx.logger.exporter({
  colors: 0,
  levels: { default: 3 },
  export: (m) => out.log.push(`${m.type} ${m.name} ${m.args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' ')}`),
})
process.on('unhandledRejection', (e) => out.log.push(`unhandledRejection ${e instanceof Error ? e.stack : String(e)}`))
process.on('uncaughtException', (e) => out.log.push(`uncaughtException ${e instanceof Error ? e.stack : String(e)}`))

// 不能顶层 await：Electron 的 ready 要等入口模块求值完才发，顶层等 ready 就互相等死
async function main() {
  await ctx.plugin(Loader, {})
  out.internalBefore = ctx.loader.internal === undefined ? 'undefined' : typeof ctx.loader.internal
  // 内核替 loader 解析裸名：CJS 条件解析到文件，再按 ESM import
  ctx.loader.internal = {
    import: (name, base) => {
      const file = createRequire(base).resolve(name)
      out.log.push(`resolve ${name} @ ${base} -> ${file}`)
      return import(pathToFileURL(file).href)
    },
  }
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])
  await ctx.loader.await()
  // 走一遍条目树，看 hello 那条的 fiber 状态（ACTIVE = 2）
  const entries = []
  const walk = (tree) => {
    for (const e of Object.values(tree?.store ?? {})) {
      entries.push({ id: e.id, pkg: e.options?.name, state: e.fiber?.state })
      walk(e.subtree)
    }
  }
  walk(ctx.loader)
  finish({ ok: true, entries, mark: globalThis.__probeHelloMounted ?? null })
}

void app.whenReady().then(main, (err) => finish({ ok: false, error: err instanceof Error ? err.stack : String(err) }))
  .catch((err) => finish({ ok: false, error: err instanceof Error ? err.stack : String(err) }))
