import type { Context } from 'cordis'

/**
 * 内核的词汇表：件说话用的那几个名词。它不做事，只命名。
 * 零运行时依赖。收进来的判据与它为什么这么小，见文档站。
 */

/** 命令与装机的回执形状 */
export interface GwbResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/** 内核挂在根上下文的服务，只有内核提供、永不撤销 */
export interface GwbKernelApi {
  /** 这个 home 的目录 */
  dataDir: string
  /** 应用版本；没传下来时是 null */
  appVersion: string | null
  /** 把包装进这个 home */
  install(specs: string[]): Promise<GwbResult<{ installed: string[] }>>
  /** 往界面推一条事件；渲染层经 window.gwb.onEvent 收 */
  emit(payload: unknown): void
}

/** 件的 apply 拿到的上下文：cordis 的 Context 加内核这一个服务 */
export interface GwbContext extends Context {
  gwbKernel: GwbKernelApi
}

/** 取内核服务。不要写进 `export const inject` */
export function requireKernel(ctx: Pick<GwbContext, 'gwbKernel'>): GwbKernelApi {
  const kernel = ctx.gwbKernel
  if (kernel === undefined) {
    throw new Error('ctx.gwbKernel 不在——这个插件跑在一个不是 gwb-kernel 的 cordis 宿主里')
  }
  return kernel
}

/** 把 unknown 收窄成对象 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
