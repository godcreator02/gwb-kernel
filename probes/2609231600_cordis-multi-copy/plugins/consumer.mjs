// 函数写法消费方：不 import cordis
export const name = 'consumer'
export const inject = ['counter']

export function apply(ctx) {
  const P = globalThis.__probe
  P.count('consumer.apply')
  const r = ctx.counter.hit()
  P.last.consumer = { ...r, selfUid: ctx.fiber.uid, callerMatch: r.callerUid === ctx.fiber.uid }
  ctx.effect(() => () => P.count('consumer.disposed'))
}
