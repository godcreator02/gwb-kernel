// 对照：不挂 tracker 的裸对象服务——inject 联动照样，但方法里拿不到消费者 ctx
export const name = 'counter-fn-plain'

export function apply(ctx) {
  const state = { n: 0 }
  ctx.provide('counter', {
    hit() {
      state.n++
      return { n: state.n, callerUid: this?.ctx?.fiber?.uid, tag: 'fn-plain(no tracker)' }
    },
  })
}
