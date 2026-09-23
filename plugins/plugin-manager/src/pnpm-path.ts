/**
 * 怎么启动 pnpm——零 I/O 纯逻辑，实际查磁盘、启动进程的部分在 `pnpm.ts`。
 *
 * 用的 pnpm 由内核经 config 交来：安装包资源目录里那个原生可执行文件（从源码运行时是内核仓依赖里的那份），
 * 直接 spawn，不开 shell。
 */

export type LookupResult = { ok: true; file: string; version: string } | { ok: false; error: string }

/** 一次 spawn 需要的三样：运行哪个文件、带什么参数、什么环境 */
export interface SpawnPlan {
  command: string
  args: string[]
  env: Record<string, string | undefined>
}

/**
 * pnpm 可执行文件 → spawn 参数。直接启动那个可执行文件，环境原样透传，只**去掉**
 * `ELECTRON_RUN_AS_NODE`——它只对 electron 有意义，留着会传给 pnpm 启动的依赖构建脚本。
 */
export function spawnPlan(file: string, args: readonly string[], env: Readonly<Record<string, string | undefined>>): SpawnPlan {
  const copy = { ...env }
  delete copy['ELECTRON_RUN_AS_NODE']
  return { command: file, args: [...args], env: copy }
}

/** 日志里那一句「用的是哪份 pnpm」 */
export function describePnpm(found: { file: string; version: string }): string {
  return `pnpm ${found.version}（${found.file}）`
}
