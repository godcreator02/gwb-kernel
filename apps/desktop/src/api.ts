/// <reference lib="dom" preserve="true" />
// 内核包根入口导出的类型（包清单 exports["."].types 指向这份的产物）：内核给插件与页面的全部接口，只有类型、没有运行时代码。
// `ShellBoot` 与 `Window` 用到 DOM 类型；写在声明里，插件的 tsconfig 不带 DOM 库、且关掉 skipLibCheck 时也能通过类型检查
import type { Context } from 'cordis'

/** @deprecated 命令回执正本由 @godcreator/gwb-commands 导出；此定义仅为旧调用方保留。 */
export interface GwbResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/** 页面请求的处理器；载荷与返回值由提供方解释，异常使页面请求拒绝。 */
export type GwbRequestHandler = (payload: unknown) => unknown

/** 内核在根上下文上提供的服务，只有内核提供、永不撤销。直接取 `ctx.gwbKernel`（不写进 `inject`） */
export interface GwbKernelApi {
  /** 这个 home 的目录 */
  dataDir: string
  /** 内核自己的版本号（内核包清单里那个） */
  version: string
  /** 往页面推一条事件；页面经 `window.gwb.on` 收 */
  emit(payload: unknown): void
  /** 登记页面请求通道；同名拒绝。返回幂等注销函数，交给 ctx.effect；注销不取消已开始的请求。 */
  handleRequest(channel: string, handler: GwbRequestHandler): () => void
  /** 登记精确的浏览器包名到本地模块 URL；整批原子登记，同名同地址复用，冲突抛错。撤销函数交给 ctx.effect。 */
  registerImports(imports: Readonly<Record<string, string>>): () => void
  /**
   * 把页面根交给这个 URL 指向的模块。模块的默认导出是 `ShellBoot`。
   * 返回撤销函数——包在 `ctx.effect` 里，插件卸载时页面根自动收回。后调用的替换先调用的。
   */
  setShell(url: string): () => void
}

/** 插件的 apply 拿到的上下文：cordis 的 Context 加内核提供的服务 */
export interface GwbContext extends Context {
  gwbKernel: GwbKernelApi
}

/** 页面上的 `window.gwb`，页面上运行的任何代码都能调用 */
export interface GwbWindowApi {
  /** 发送请求；通道未登记时以 GWB_REQUEST_UNAVAILABLE: <channel> 拒绝，其他传输与处理器错误照常拒绝。 */
  request(channel: string, payload?: unknown): Promise<unknown>
  /** 在动态 import 前等待当前映射注入；可检查必需名字。已注入的地址改变或撤销时拒绝，需整页重载。 */
  prepareImports(required?: readonly string[]): Promise<void>
  /** @deprecated 新调用方使用 @godcreator/gwb-commands/client 的 command；此入口仅为旧调用方保留。 */
  command<T = unknown>(command: string, args?: unknown): Promise<T>
  /** 收插件经 `gwbKernel.emit` 推来的事件，返回取消订阅的函数 */
  on(cb: (payload: unknown) => void): () => void
  /**
   * 外壳换了。订阅时先收到当前值（没有外壳时 url 是 null），返回取消订阅的函数。
   * 只有内核自己的页面用这一条
   */
  onShell(cb: (shell: { url: string | null }) => void): () => void
}

/** 外壳模块的默认导出：接管页面根，返回一个可选的清理句柄 */
export type ShellBoot = (root: HTMLElement) => { dispose?(): void } | undefined | void

/**
 * 页面的全局声明：import 本包的类型（哪怕只是 `import type {}`），TypeScript 就认得 `window.gwb`。
 */
declare global {
  interface Window {
    gwb: GwbWindowApi
  }
}
