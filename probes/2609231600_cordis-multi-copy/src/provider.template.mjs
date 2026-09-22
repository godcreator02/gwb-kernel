// 模板：__CORDIS__ 由 gen.mjs 替换成 'cordis'（宿主 rc.9）或 'cordis10'（另一份 rc.10）
import { Service } from '__CORDIS__'

const TAG = '__TAG__'

export default class Counter extends Service {
  constructor(ctx) {
    super(ctx, 'counter')
    this.state = { n: 0 }
    globalThis.__probe.log(`provider[${TAG}] ctor fiber=${ctx.fiber.uid}`)
    ctx.effect(() => () => globalThis.__probe.log(`provider[${TAG}] effect disposed`))
  }

  hit() {
    this.state.n++
    return { n: this.state.n, callerUid: this.ctx.fiber.uid, callerName: this.ctx.fiber.runtime?.name, tag: TAG }
  }
}
Counter.ServiceClass = Service
