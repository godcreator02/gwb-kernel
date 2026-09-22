// 类写法、跨份：既 inject counter，又 provide viewer（二级联动）
import { Service } from '__CORDIS__'

const TAG = '__TAG__'

export default class Viewer extends Service {
  static inject = ['counter']
  constructor(ctx) {
    super(ctx, 'viewer')
    const P = globalThis.__probe
    P.count('viewer.ctor')
    this.first = ctx.counter.hit()
    ctx.effect(() => () => P.count('viewer.disposed'))
  }

  peek() {
    return { viewerCallerUid: this.ctx.fiber.uid, tag: TAG, counterSeenAtCtor: this.first }
  }
}
