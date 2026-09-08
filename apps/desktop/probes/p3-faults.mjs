// 探针三：件在主进程里出错，应用活不活、弹不弹框。
// 三种错各一条条目（apply 同步抛、定时器里没人接的 rejection、定时器里同步抛），外加一条好的 hello。
// P3_HANDLERS=0 时不挂 process.on 监听——看 Electron 自己的默认行为（预期弹模态框、探针超时被杀）。
// 断言：主进程在三种错之后仍能跑到 1.5 秒后的收尾（模态框会把主线程卡住，收尾就到不了）；hello 仍是 ACTIVE。
import electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'

const { app, BrowserWindow } = electron
const here = path.dirname(fileURLToPath(import.meta.url))
const home = path.resolve(here, 'homes', 'probe3')
const withHandlers = process.env.P3_HANDLERS !== '0'
const outFile = path.join(here, `p3-faults.${withHandlers ? 'handled' : 'bare'}.out.json`)
const out = { withHandlers, log: [], caught: [] }

function finish(extra) {
  Object.assign(out, extra)
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
  app.exit(0)
}

// 一进来先写一份「还没完」——被模态框卡死时靠它分辨是没跑到还是没写
fs.writeFileSync(outFile, JSON.stringify({ withHandlers, unfinished: true }, null, 2))

if (withHandlers) {
  process.on('unhandledRejection', (e) => out.caught.push(`unhandledRejection: ${e instanceof Error ? e.message : String(e)}`))
  process.on('uncaughtException', (e) => out.caught.push(`uncaughtException: ${e instanceof Error ? e.message : String(e)}`))
}

const ctx = new Context()
ctx.baseUrl = pathToFileURL(home + path.sep).href
ctx.logger.exporter({
  colors: 0,
  levels: { default: 3 },
  export: (m) => out.log.push(`${m.type} ${m.name} ${m.args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')}`),
})

async function main() {
  // 开一扇窗：模态错误框是挂在窗上的，有窗更接近真实形态
  const win = new BrowserWindow({ show: false })
  await win.loadURL('about:blank')
  await ctx.plugin(Loader, {})
  ctx.loader.internal = {
    import: (name, base) => import(pathToFileURL(createRequire(base).resolve(name)).href),
  }
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: 'home', name: 'cordis:include', config: { path: 'cordis.yml' } }])
  await ctx.loader.await()
  // 等定时器里那两种错发生完
  setTimeout(() => {
    const entries = []
    const walk = (tree) => {
      for (const e of Object.values(tree?.store ?? {})) {
        entries.push({ id: e.id, state: e.fiber?.state })
        walk(e.subtree)
      }
    }
    walk(ctx.loader)
    finish({ ok: true, survived: true, windowAlive: !win.isDestroyed(), entries })
  }, 1500)
}

void app.whenReady().then(main).catch((err) => finish({ ok: false, error: err instanceof Error ? err.stack : String(err) }))
