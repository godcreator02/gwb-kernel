// 核对 run.mjs 里那几条 unhandledRejection 是谁调用的 fiber.await() 留下的：
// 给 Fiber.prototype.await 返回的 promise 的 finally 记下调用处，再原样跑一遍 run.mjs，只打印每条的调用处。
import { Fiber } from 'cordis'

const original = Fiber.prototype.await
Fiber.prototype.await = function () {
  const promise = original.call(this)
  const callSite = new Error().stack.split('\n').slice(2, 4).map((l) => l.trim()).join(' <- ')
  const finallyOriginal = promise.finally.bind(promise)
  promise.finally = (cb) => Object.assign(finallyOriginal(cb), { callSite })
  return promise
}

const here = new URL('.', import.meta.url).href
const origins = []
process.on('unhandledRejection', (e, p) => origins.push(`${e.message}\n  调用处: ${(p.callSite ?? '(未标记)').replaceAll(here, '<probe>/')}`))
const log = console.log
console.log = () => {}
await import('./run.mjs')
console.log = log
console.log(origins.join('\n') || '(没有 unhandledRejection)')
