import type { Entry } from '@cordisjs/plugin-loader'

/**
 * 页面上那份只读现状的条目状态分类器：把 loader 的一个 Entry 说出它到了哪一步。状态词照
 * cordis 的 FiberState 原名，fiber 之外还有 disabled 与「没有 fiber（import 失败）」两种。
 * PENDING 带缺哪个服务、FAILED 带错误第一行。见文档站
 *
 * 这个文件不碰 electron、不碰 cordis 实例：进来一个 Entry，出去一句现状——单测手造条目就能跑
 */

/** 只读现状里一条条目的那一行：id、名字、到哪一步 */
export interface EntryStatus {
  id: string
  name: string
  state: string
}

// 状态名照 cordis 的 FiberState 原名。它是 const enum，isolatedModules 下引用不到，按它的定义照抄数字顺序；
// _error 与 _store 是 cordis 标了 private 的普通字段（失败原因、已就绪的 inject）
const FIBER_STATE = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING'] as const
interface FiberPeek {
  state: number
  inject: Record<string, unknown>
  _error?: unknown
  _store?: Record<string, unknown>
}
const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))

export function describeEntry(entry: Entry): string {
  if (entry.disabled) return 'disabled'
  const fiber = entry.fiber as unknown as FiberPeek | undefined
  if (fiber === undefined) return 'no fiber（import 失败，原因在错误行里）'
  const state = FIBER_STATE[fiber.state] ?? `state=${String(fiber.state)}`
  if (state === 'PENDING') {
    const missing = Object.keys(fiber.inject).filter((name) => !(name in (fiber._store ?? {})))
    return `PENDING（缺 ${missing.length > 0 ? missing.join('、') : '？'}）`
  }
  if (state === 'FAILED') return `FAILED：${stackOf(fiber._error).split('\n')[0] ?? ''}`
  return state
}
