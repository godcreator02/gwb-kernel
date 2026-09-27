import type { Entry } from '@cordisjs/plugin-loader'

/** 只读状态页上一个条目的那一行：id、包名、加载到哪一步 */
export interface EntryStatus {
  id: string
  name: string
  state: string
}

// cordis 的 FiberState 是 const enum，isolatedModules 下引用不到，按它的定义照抄数字顺序
const FIBER_STATE_NAMES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING'] as const

/** 读条目状态要用的 fiber 字段；`_error`（失败原因）与 `_store`（已就绪的 inject）是 cordis 标了 private 的普通字段 */
export interface FiberInternals {
  state: number
  inject: Record<string, unknown>
  _error?: unknown
  _store?: Record<string, unknown>
}

/** 条目加载到哪一步。`other` 是 LOADING、ACTIVE、DISPOSED、UNLOADING 与认不出的状态数字 */
export type EntryCondition =
  | { kind: 'disabled' }
  | { kind: 'no-fiber' }
  | { kind: 'pending'; missingServices: string[] }
  | { kind: 'failed'; firstErrorLine: string }
  | { kind: 'other'; stateName: string }

const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))

function servicesStillMissing(fiber: FiberInternals): string[] {
  return Object.keys(fiber.inject).filter((serviceName) => !(serviceName in (fiber._store ?? {})))
}

function firstLineOf(text: string): string {
  return text.split('\n')[0] ?? ''
}

export function conditionOfFiber(fiber: FiberInternals): EntryCondition {
  const stateName = FIBER_STATE_NAMES[fiber.state] ?? `state=${String(fiber.state)}`
  if (stateName === 'PENDING') return { kind: 'pending', missingServices: servicesStillMissing(fiber) }
  if (stateName === 'FAILED') return { kind: 'failed', firstErrorLine: firstLineOf(stackOf(fiber._error)) }
  return { kind: 'other', stateName }
}

export function conditionOfEntry(entry: Entry): EntryCondition {
  if (entry.disabled) return { kind: 'disabled' }
  const fiber = entry.fiber as unknown as FiberInternals | undefined
  if (fiber === undefined) return { kind: 'no-fiber' }
  return conditionOfFiber(fiber)
}

/** 条目加载到哪一步，说成只读状态页上的一句话 */
export function describeEntry(entry: Entry): string {
  const condition = conditionOfEntry(entry)
  switch (condition.kind) {
    case 'disabled':
      return 'disabled'
    case 'no-fiber':
      return 'no fiber（import 失败，原因在错误行里）'
    case 'pending':
      return `PENDING（缺 ${condition.missingServices.length > 0 ? condition.missingServices.join('、') : '？'}）`
    case 'failed':
      return `FAILED：${condition.firstErrorLine}`
    case 'other':
      return condition.stateName
  }
}
