import type { Context } from 'cordis'

/**
 * 内核的词汇表:插件说话用的那几个名词。**它不做事,只命名。**
 *
 * 收进来的判据是「多数件都要，而且它说的是内核与插件之间的事」。实测母仓 11 件从平台包
 * 只取了 12 个名字,其中 11 件全用 / 7 件 / 6 件的就是下面这三样;其余要么是插件之间的
 * 契约（http 件对 mcp 件的承诺那种,该住提供方自己的包里),要么是实现细节漏出。
 *
 * 零运行时依赖。cordis 只 import type——运行时不引它,所以是 devDependency 不是 peer。
 */

/** 命令与装机的回执形状。ok 为假时 error 说人话 */
export interface GwbResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/** 内核挂在根上下文的那个服务。**只有内核提供,永不撤销** */
export interface GwbKernelApi {
  /** 这个 home 的目录。要落盘、要读 home 里的东西,从这儿起步 */
  dataDir: string
  /** 应用版本;谁自己 spawn 了宿主而没传下来时是 null——那时别拿编出来的号去判事 */
  appVersion: string | null
  /** 把包装进这个 home。registry 归 pnpm 按 .npmrc 决定 */
  install(specs: string[]): Promise<GwbResult<{ installed: string[] }>>
  /** 往界面推一条事件。渲染层经 window.gwb.onEvent 收 */
  emit(payload: unknown): void
}

/** 插件 apply 拿到的上下文:cordis 的 Context 加内核这一个服务 */
export interface GwbContext extends Context {
  gwbKernel: GwbKernelApi
}

/**
 * 取内核服务。**不要写进 `export const inject`**——它在根上下文 provide、永不撤销,
 * 写进 inject 只会让件多一处挂不上的可能。
 * 挂在别的 cordis 宿主里时,这句报错说得清「这不是工作台」。
 */
export function requireKernel(ctx: Pick<GwbContext, 'gwbKernel'>): GwbKernelApi {
  const kernel = ctx.gwbKernel
  if (kernel === undefined) {
    throw new Error('ctx.gwbKernel 不在——这个插件跑在一个不是 gwb-kernel 的 cordis 宿主里')
  }
  return kernel
}

/** 把 unknown 收窄成对象。命令参数、配置、总线上过来的东西都得先过这关 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
