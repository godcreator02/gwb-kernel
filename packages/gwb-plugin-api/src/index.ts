import type { Context } from 'cordis'

/**
 * 内核的词汇表：件说话用的那几个名词。它不做事，只命名。零运行时依赖。
 * 这是件与内核之间的全部契约面：node 半四个名字，页面三个函数，外壳一个导出形状。
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
   * 回撤销函数——包在 `ctx.effect` 里，件卸载时页面根自动收回。后调的顶掉先调的。
   */
  setShell(url: string): () => void
}

/** 件的 apply 拿到的上下文：cordis 的 Context 加内核这一个服务 */
export interface GwbContext extends Context {
  gwbKernel: GwbKernelApi
}

/**
 * 曾经的两个运行时薄 helper（`requireKernel`、`isRecord`）已于 2026-09-22 移除——各件把这两
 * 个无状态纯函数内联进自己的 `src/vocab.ts`（实施 Spec D6：本包收敛为纯类型契约面，仅随
 * kernel 版本发版）。此版本起本包零运行时导出。
 */

/** 页面的公共面 `window.gwb`。谁在这页上跑都够得着 */
export interface GwbWindowApi {
  /** 调一条命令。除内核自己一条都不认，全派给提供 `gwbCommands` 的件 */
  command<T = unknown>(command: string, args?: unknown): Promise<T>
  /** 收件经 `gwbKernel.emit` 推来的事件，回注销函数 */
  on(cb: (payload: unknown) => void): () => void
  /**
   * 外壳换了。订上就先收到当前值（没有外壳 url 是 null），回注销函数。
   * `imports` 是页面级 importmap：home 里各包 `gwb.shared` 声明的裸名 → file:// 地址，内核收齐的。
   * 页面注完它才 import 外壳。这一条只有内核自己的页面在用
   */
  onShell(cb: (shell: { url: string | null; imports: Record<string, string> }) => void): () => void
}

/** 外壳模块的默认导出：拿走页面根，回一个可选的拆树句柄 */
export type ShellBoot = (root: HTMLElement) => { dispose?(): void } | undefined | void

/**
 * 页面全局声明：import 本包（哪怕 `import type {}`），TypeScript 就认得 `window.gwb`。
 * 浏览器半不用再翻别人的产物找 `window.gwb.command` 的形状——它就在这儿。
 */
declare global {
  interface Window {
    gwb: GwbWindowApi
  }
}
