// 问 cordis 的 fiber.dispose() 到底等不等嵌套的异步收尾。
// 零依赖：cordis 从本仓 apps/desktop 的 node_modules 里按相对位置取。
const { Context } = await import(new URL('../../apps/desktop/node_modules/cordis/lib/index.js', import.meta.url).href)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 三层插件链：顶层 → child → grandchild，grandchild 的收尾返回一个 300ms 的 promise
// （站件杀进程树就是这个形状：收尾是异步的、要真等）
const mk = (name, depth) => ({
  name,
  apply(c) {
    if (depth < 3) {
      void c.plugin(mk(`${name}-child`, depth + 1), {})
    } else {
      c.effect(() => () => {
        console.log('  [grandchild cleanup 起]')
        return new Promise((r) => setTimeout(() => { console.log('  [grandchild cleanup 完（300ms）]'); r() }, 300))
      })
    }
  },
})

const ctx = new Context()
const fiber = await ctx.plugin(mk('top', 1), {})
await sleep(50)

const mode = process.argv[2] ?? 'dispose-only'
const t = Date.now()
if (mode === 'dispose-only') {
  await fiber.dispose()
} else {
  await fiber.dispose()
  await fiber.await()
}
console.log(`${mode}: 总耗时 ${Date.now() - t}ms`)
await sleep(400)
