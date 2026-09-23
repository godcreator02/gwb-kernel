import type { Context } from 'cordis'

/**
 * 内核的词汇表：插件与页面用到的内核接口的类型。只有类型，没有运行时代码。
 * 插件与内核之间的全部契约都在这里：主进程一侧是 `gwbKernel` 与命令总线 `gwbCommands`，
 * 页面一侧是 `window.gwb` 的三个函数，外壳是一个默认导出的形状。
 */

/** 命令的回执形状 */
export interface GwbResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/** 内核挂在根上下文的服务，只有内核提供、永不撤销。直接取 `ctx.gwbKernel`（不写进 `inject`） */
export interface GwbKernelApi {
  /** 这个 home 的目录 */
  dataDir: string
  /** 内核自己的版本号（内核包清单里那个） */
  version: string
  /** 往页面推一条事件；页面经 `window.gwb.on` 收 */
  emit(payload: unknown): void
  /**
   * 把页面根交给这个 URL 指向的模块。模块的默认导出是 `ShellBoot`。
   * 返回撤销函数——包在 `ctx.effect` 里，插件卸载时页面根自动收回。后调用的替换先调用的。
   */
  setShell(url: string): () => void
}

/** 一条命令的说明。`plugin` 由登记方自己填写 */
export interface GwbCommandDef {
  name: string
  /** 一句话介绍，出现在 MCP 入口 index 的清单里，作用与说明书的 description 相同 */
  description?: string
  /** 用法：参数形状、注意事项。search 命中的那一行带它，调用之前看它（无参数的命令可以不给） */
  usage?: string
  plugin: string
}

/** 命令总线，由内核内置的命令插件提供，一定存在。直接取 `ctx.gwbCommands`（不必写进 `inject`） */
export interface GwbCommands {
  /** 登记一条命令，返回注销函数；调用方用 ctx.effect 包住，卸载时自动注销 */
  register(def: GwbCommandDef, handler: (args?: unknown) => unknown): () => void
  list(): Required<GwbCommandDef>[]
  run(name: string, args?: unknown): Promise<GwbResult>
}

/** 插件的 apply 拿到的上下文：cordis 的 Context 加内核提供的两个服务 */
export interface GwbContext extends Context {
  gwbKernel: GwbKernelApi
  gwbCommands: GwbCommands
}

/** 页面上的 `window.gwb`，页面上运行的任何代码都能调用 */
export interface GwbWindowApi {
  /** 调一条命令。内核不认识命令名，一律交给命令总线 */
  command<T = unknown>(command: string, args?: unknown): Promise<T>
  /** 收插件经 `gwbKernel.emit` 推来的事件，返回取消订阅的函数 */
  on(cb: (payload: unknown) => void): () => void
  /**
   * 外壳换了。订阅时先收到当前值（没有外壳时 url 是 null），返回取消订阅的函数。
   * `imports` 是页面的 importmap：home 里各包 `gwb.shared` 声明的包名 → file:// 地址，由内核收集。
   * 页面先注入它再 import 外壳。只有内核自己的页面用这一条
   */
  onShell(cb: (shell: { url: string | null; imports: Record<string, string> }) => void): () => void
}

/** 外壳模块的默认导出：接管页面根，返回一个可选的清理句柄 */
export type ShellBoot = (root: HTMLElement) => { dispose?(): void } | undefined | void

/**
 * 页面的全局声明：import 本包（哪怕只是 `import type {}`），TypeScript 就认得 `window.gwb`。
 */
declare global {
  interface Window {
    gwb: GwbWindowApi
  }
}
