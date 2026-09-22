// 二级消费方：inject viewer（viewer 又 inject counter）；不 import cordis
export const name = 'leaf'
export const inject = ['viewer']

export function apply(ctx) {
  const P = globalThis.__probe
  P.count('leaf.apply')
  const r = ctx.viewer.peek()
  P.last.leaf = { ...r, selfUid: ctx.fiber.uid, callerMatch: r.viewerCallerUid === ctx.fiber.uid }
  ctx.effect(() => () => P.count('leaf.disposed'))
}
