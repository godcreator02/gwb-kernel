// 依赖方：inject 一个服务，记下加载 / 卸载次数和每次加载时拿到的是哪一份（服务值上的 source）
const P = () => globalThis.__probe

export function consumer(pluginName, serviceName) {
  return {
    name: pluginName,
    inject: [serviceName],
    apply(ctx) {
      P().count(`${pluginName}.apply`)
      const seen = ctx[serviceName]?.source
      P().seen(pluginName, seen)
      ctx.effect(() => () => P().count(`${pluginName}.dispose`))
    },
  }
}
