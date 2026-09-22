// 宿主 = node_modules/cordis（4.0.0-rc.9，与内核打进 app.asar 的那版同号）；插件按场景换 cordis 来源。
// 先跑 gen.mjs 生成 dist/ 里的变体，再跑本脚本。纯 node，不起 Electron、不碰任何 gwb home。
import fs from 'node:fs'
import process from 'node:process'
import { Context, Service as HostService } from 'cordis'
import { Service as BService } from 'cordis10'
import Loader from '@cordisjs/plugin-loader'

const here = new URL('.', import.meta.url)
const ver = (p) => JSON.parse(fs.readFileSync(new URL(`node_modules/${p}/package.json`, here), 'utf8')).version
console.log(`node ${process.version} | host cordis ${ver('cordis')} | cordis10 ${ver('cordis10')} | plugin-loader ${ver('@cordisjs/plugin-loader')} | esbuild ${ver('esbuild')}`)

const settle = () => new Promise((r) => setTimeout(r, 30))
const P = (globalThis.__probe = {
  counts: {}, last: {}, logs: [],
  count(k) { this.counts[k] = (this.counts[k] ?? 0) + 1 },
  log(s) { this.logs.push(s) },
  reset() { this.counts = {}; this.last = {}; this.logs = [] },
})

const errors = []
process.on('unhandledRejection', (e) => errors.push('unhandledRejection: ' + (e?.stack ?? e)))

function newHost() {
  const ctx = new Context()
  // 收宿主 logger 的 error / warn：插件挂不上、服务撞名、inject 取不到都从这儿冒
  ctx.logger.exporter({
    export(m) {
      if (m.type === 'error' || m.type === 'warn') errors.push(`${m.type} [${m.name}] ${m.args.map((a) => a?.message ?? String(a)).join(' ')}`)
    },
  })
  return ctx
}
const S = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']
const st = (f) => S[f.state]
const storeKeys = (ctx) => Reflect.ownKeys(ctx.reflect.store).map(String)

// 链：provider(counter) ← consumer（函数写法）；provider ← viewer（类写法，inject counter 又 provide viewer）← leaf
async function direct(label, providerPath, viewerPath) {
  P.reset(); errors.length = 0
  const ctx = newHost()
  const baseRegistry = ctx.registry.size
  const pm = await import(providerPath)
  const provider = pm.default ?? pm
  const Viewer = (await import(viewerPath)).default
  const consumer = await import('./plugins/consumer.mjs')
  const leaf = await import('./plugins/leaf.mjs')

  const fc = ctx.plugin(consumer), fv = ctx.plugin(Viewer), fl = ctx.plugin(leaf)
  await settle()
  const before = `consumer=${st(fc)} viewer=${st(fv)} leaf=${st(fl)}`
  let fp = ctx.plugin(provider); await fp; await settle()
  const svc = ctx.get('counter')
  const r1 = { states: `provider=${st(fp)} consumer=${st(fc)} viewer=${st(fv)} leaf=${st(fl)}`, counts: { ...P.counts }, consumer: P.last.consumer, leaf: P.last.leaf,
    instanceofHost: svc instanceof HostService, instanceofB: svc instanceof BService }
  await fp.dispose(); await settle()
  const r2 = { states: `provider=${st(fp)} consumer=${st(fc)} viewer=${st(fv)} leaf=${st(fl)}`, counts: { ...P.counts }, counterGone: ctx.get('counter') === undefined, store: storeKeys(ctx) }
  fp = ctx.plugin(provider); await fp; await settle()
  const r3 = { states: `provider=${st(fp)} consumer=${st(fc)} viewer=${st(fv)} leaf=${st(fl)}`, counts: { ...P.counts }, consumerN: P.last.consumer?.n }
  for (const f of [fl, fv, fc, fp]) await f.dispose()
  await settle()
  const r4 = { registryDelta: ctx.registry.size - baseRegistry, store: storeKeys(ctx), props: Object.keys(ctx.reflect.props).filter((k) => ['counter', 'viewer'].includes(k)) }
  console.log(`\n=== ${label} ===`)
  console.log('before provider :', before)
  console.log('provide/inject  :', JSON.stringify(r1))
  console.log('provider off    :', JSON.stringify(r2))
  console.log('provider back   :', JSON.stringify(r3))
  console.log('all disposed    :', JSON.stringify(r4))
  console.log('probe log       :', P.logs.join(' | '))
  console.log('errors          :', errors.length ? errors : 'none')
}

// 同一条链走 @cordisjs/plugin-loader：条目 create / disabled 开关 / remove
async function viaLoader(label, providerRel, viewerRel) {
  P.reset(); errors.length = 0
  const ctx = newHost()
  ctx.plugin(Loader, { baseUrl: here.href })
  await settle()
  const L = ctx.loader
  await L.create({ id: 'consumer', name: './plugins/consumer.mjs' })
  await L.create({ id: 'viewer', name: viewerRel })
  await L.create({ id: 'leaf', name: './plugins/leaf.mjs' })
  await L.create({ id: 'counter', name: providerRel })
  await L.await(); await settle()
  const e = (id) => st(L.resolve(id).fiber)
  const s = () => `counter=${e('counter')} consumer=${e('consumer')} viewer=${e('viewer')} leaf=${e('leaf')}`
  const r1 = { states: s(), counts: { ...P.counts }, callerMatch: P.last.consumer?.callerMatch, leafMatch: P.last.leaf?.callerMatch }
  await L.update('counter', { disabled: true }); await L.await(); await settle()
  const r2 = { states: `consumer=${e('consumer')} viewer=${e('viewer')} leaf=${e('leaf')}`, counts: { ...P.counts } }
  await L.update('counter', { disabled: null }); await L.await(); await settle()
  const r3 = { states: s(), counts: { ...P.counts } }
  for (const id of ['leaf', 'viewer', 'consumer', 'counter']) L.remove(id)
  await L.await(); await settle()
  const r4 = { store: storeKeys(ctx).filter((k) => /counter|viewer/.test(k)) }
  console.log(`\n=== LOADER: ${label} ===`)
  console.log('provide/inject  :', JSON.stringify(r1))
  console.log('provider off    :', JSON.stringify(r2))
  console.log('provider back   :', JSON.stringify(r3))
  console.log('all removed     :', JSON.stringify(r4))
  console.log('errors          :', errors.length ? errors : 'none')
}

await direct('(b) same copy: provider/viewer import host cordis rc.9', './dist/provider-host.mjs', './dist/viewer-host.mjs')
await direct('(a) other copy: provider/viewer import cordis10 (rc.10, separate module instance)', './dist/provider-b.mjs', './dist/viewer-b.mjs')
await direct('(c1) esbuild bundle: cordis rc.10 inlined', './dist/provider-bundled10.mjs', './dist/viewer-bundled10.mjs')
await direct('(c2) esbuild bundle: cordis rc.9 inlined (same version, different instance)', './dist/provider-bundled9.mjs', './dist/viewer-bundled9.mjs')
await direct('(4) functional provider: no cordis import, Symbol.for tracker', './plugins/provider-fn.mjs', './dist/viewer-b.mjs')
await direct('(4-control) plain-object provider: no tracker', './plugins/provider-fn-plain.mjs', './dist/viewer-host.mjs')
await viaLoader('(a) cordis10 other copy', './dist/provider-b.mjs', './dist/viewer-b.mjs')
await viaLoader('(c1) bundled rc.10', './dist/provider-bundled10.mjs', './dist/viewer-bundled10.mjs')
await viaLoader('(4) functional', './plugins/provider-fn.mjs', './dist/viewer-host.mjs')
