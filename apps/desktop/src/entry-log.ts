import type { Context, Fiber } from 'cordis'
import type { Entry } from '@cordisjs/plugin-loader'
import { conditionOfEntry, conditionOfFiber, type FiberInternals } from './entry-state.js'

/** 条目树连着变（启动时逐条加载、插件管理一次换几个包）时，停下来这么久才写汇总 */
const SUMMARY_DEBOUNCE_MS = 300

// cordis 的 FiberState 是 const enum，isolatedModules 下引用不到，按它的定义照抄数字
const PENDING = 0
const LOADING = 1
const ACTIVE = 2
const DISPOSED = 4

export interface EntryLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export interface EntryLogWatch {
  /** 退出时调用：卸载整棵插件树时不再逐条写卸载与汇总 */
  stop(): void
}

/** include 与分组条目只是装条目的容器，不算插件 */
function isPluginEntry(entry: Entry): boolean {
  return entry.subtree === undefined && entry.options.group !== true
}

/** 插件里再 ctx.plugin 出来的子 fiber 也带着同一个 entry：父 fiber 属于同一个条目的是子 fiber */
function pluginEntryOwnedBy(fiber: Fiber): Entry | undefined {
  const entry = fiber.entry
  if (entry === undefined || fiber.parent.fiber?.entry === entry) return undefined
  return isPluginEntry(entry) ? entry : undefined
}

interface EntrySummary {
  message: string
  level: keyof EntryLogger
}

/** 等条目树安定之后的一行汇总：有失败或没导入成功是 error，只有在等或状态未定的是 warn */
export function summarizeEntries(entries: Iterable<Entry>): EntrySummary {
  let active = 0
  let disabled = 0
  const waiting: string[] = []
  const failed: string[] = []
  const notImported: string[] = []
  const unsettled: string[] = []
  for (const entry of entries) {
    if (!isPluginEntry(entry)) continue
    const name = entry.options.name
    const condition = conditionOfEntry(entry)
    if (condition.kind === 'disabled') disabled++
    else if (condition.kind === 'no-fiber') notImported.push(name)
    else if (condition.kind === 'pending') waiting.push(`${name}（缺 ${condition.missingServices.join('、')}）`)
    else if (condition.kind === 'failed') failed.push(name)
    else if (condition.stateName === 'ACTIVE') active++
    else unsettled.push(`${name}（${condition.stateName}）`)
  }
  const parts = [`条目加载完：${active} 个挂上`]
  if (disabled > 0) parts.push(`${disabled} 个停用`)
  if (waiting.length > 0) parts.push(`在等：${waiting.join('，')}`)
  if (failed.length > 0) parts.push(`挂载失败：${failed.join('，')}（原因见前面各自的 error）`)
  if (notImported.length > 0) parts.push(`没导入成功：${notImported.join('，')}（原因见 include 的 error）`)
  if (unsettled.length > 0) parts.push(`状态未定：${unsettled.join('，')}`)
  const level = failed.length + notImported.length > 0 ? 'error' : waiting.length + unsettled.length > 0 ? 'warn' : 'info'
  return { message: parts.join('；'), level }
}

/**
 * 每个插件条目挂上（带 apply 耗时）、挂载失败、卸载、退回等待各写一行；条目树有变化时，等 `ctx.loader.await()` 之后写一行汇总。
 * 一开始就缺服务的条目不发任何 `internal/status`，只能靠汇总报出来
 */
export function watchEntryStates(ctx: Context, log: EntryLogger): EntryLogWatch {
  const loadingSince = new WeakMap<Fiber, number>()
  let pendingSummary: NodeJS.Timeout | null = null
  let stopped = false

  async function writeSummary(): Promise<void> {
    await ctx.loader.await()
    if (stopped) return
    const summary = summarizeEntries(ctx.loader.entries())
    log[summary.level](summary.message)
  }

  function scheduleSummary(): void {
    if (stopped) return
    if (pendingSummary !== null) clearTimeout(pendingSummary)
    pendingSummary = setTimeout(() => {
      pendingSummary = null
      void writeSummary()
    }, SUMMARY_DEBOUNCE_MS)
  }

  function logTransition(fiber: Fiber, entry: Entry, oldState: number): void {
    const name = entry.options.name
    const condition = conditionOfFiber(fiber as unknown as FiberInternals)
    if (fiber.state === LOADING) {
      loadingSince.set(fiber, performance.now())
    } else if (fiber.state === ACTIVE) {
      const applyMs = Math.round(performance.now() - (loadingSince.get(fiber) as number))
      log.info(`${name} 挂上了（apply ${applyMs} ms）`)
    } else if (condition.kind === 'failed') {
      log.error(`${name} 挂载失败：${condition.firstErrorLine}`)
    } else if (fiber.state === DISPOSED) {
      log.info(`${name} 已卸载`)
    } else if (condition.kind === 'pending' && oldState !== PENDING) {
      log.info(`${name} 退回等待：缺 ${condition.missingServices.join('、')}`)
    }
  }

  ctx.on('internal/status', (fiber, oldState) => {
    if (stopped) return
    const entry = pluginEntryOwnedBy(fiber)
    if (entry === undefined) return
    logTransition(fiber, entry, oldState)
    scheduleSummary()
  })
  ctx.on('loader/entry-init', () => scheduleSummary())

  return {
    stop() {
      stopped = true
      if (pendingSummary !== null) clearTimeout(pendingSummary)
    },
  }
}
