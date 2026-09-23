// 提供服务的两种写法。每次调用都造一个新的插件对象（新的 apply / 新的类），
// 对应实际情况：内置那份打进内核，cordis.yml 那份从 home 的 node_modules 解析，是两个不同的模块实例。
import { Service } from 'cordis'

const P = () => globalThis.__probe

/** 函数写法，照 plugins/commands 的 apply：ctx.effect 里 ctx.provide，provide 之后打一行 info */
export function functionalProvider(pluginName, serviceName, source, extra = {}) {
  const value = { source, ...extra }
  return {
    name: pluginName,
    apply(ctx) {
      P().count(`${pluginName}.apply`)
      ctx.effect(() => {
        const unprovide = ctx.provide(serviceName, value)
        ctx.logger(pluginName).info(`${serviceName} 已提供（${source}）`)
        return () => {
          P().count(`${pluginName}.unprovide`)
          return unprovide()
        }
      })
    },
  }
}

/** Service 基类写法：super(ctx, serviceName) 在构造函数里调用 ctx.reflect.provide */
export function serviceClassProvider(pluginName, serviceName, source, extra = {}) {
  const cls = class extends Service {
    constructor(ctx) {
      P().count(`${pluginName}.ctor`)
      super(ctx, serviceName)
      this.source = source
      Object.assign(this, extra)
      ctx.logger(pluginName).info(`${serviceName} 已提供（${source}）`)
    }
  }
  Object.defineProperty(cls, 'name', { value: pluginName })
  return cls
}
