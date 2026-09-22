// 第 4 项：不按值 import cordis 的函数式服务写法
// ctx.provide(name, value) 登记服务（effect，随本 fiber 撤销）；
// 可选：值上挂 Symbol.for('cordis.tracker') 就得到与 Service 同款的「方法里 this.ctx = 消费者 ctx」
const TRACKER = Symbol.for('cordis.tracker')

export const name = 'counter-fn'

export function apply(ctx) {
  const P = globalThis.__probe
  const state = { n: 0 }
  const svc = {
    [TRACKER]: { associate: 'counter', property: 'ctx' },
    hit() {
      state.n++
      return { n: state.n, callerUid: this.ctx?.fiber.uid, callerName: this.ctx?.fiber.runtime?.name, tag: 'fn(no import)' }
    },
  }
  ctx.provide('counter', svc)
  P.log(`provider[fn] apply fiber=${ctx.fiber.uid}`)
  ctx.effect(() => () => P.log('provider[fn] effect disposed'))
}
