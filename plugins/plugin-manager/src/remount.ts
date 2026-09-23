import { isRecord } from './vocab.js'
import type { EntryTreeLike } from './tree.js'
import { fiberStateOf, settleFiber } from './update-all.js'

/**
 * 条目重新加载：停用 → 等旧 fiber 卸载完 → 启用 → 等新 fiber 启动完。一键热升级与 `remount` 命令
 * 共用这一套时序。
 *
 * **停用与启用在同一条 await 链里做完，中间不经过第二条命令。** 这条链只持有条目树与 logger，不经任何 ctx；
 * 被重新加载的条目卸载时连带卸掉的插件（inject 了它的那些）不影响它继续执行。
 */

/** 停用/启用之后等 fiber 把手头的事做完，最多等这么久。超时就继续，读到什么状态报什么 */
export const SETTLE_MS = 5_000

/** 一条条目重新加载的结果 */
export interface RemountedEntry {
  /** 不带前缀的 id */
  id: string
  /**
   * `remounted`：停用再启用，重新 import 了新版本；`skipped`：本来就停用，保持停用（只在一键热升级里出现）；
   * `failed`：操作条目树时抛错，`state` 里是那句错误
   */
  action: 'remounted' | 'skipped' | 'failed'
  /** 重新加载之后 fiber 到哪一步（ACTIVE / PENDING / FAILED…）。skipped 是 disabled */
  state: string
}

/** 重新加载要用的两个日志级别 */
export interface RemountLog {
  info(message: string): void
  warn(message: string): void
}

/**
 * 停用 → 等旧 fiber 卸载完 → 启用（`_init` 重新 `tree.import`，拿到新版本）→ 等新 fiber 启动完，
 * 返回它的状态。**等旧的卸载完再启用**：loader 的 `update({ disabled: true })` 调 `fiber.dispose()`
 * 不等它完成，而 Service 插件的 provide 是在卸载过程中撤销的——不等就启用，新 fiber 启动时旧服务
 * 可能还没撤销，cordis 会报「service has been registered」。原本停用的条目，最终状态是启用
 */
export async function remountEntry(tree: EntryTreeLike, id: string, settleMs: number = SETTLE_MS): Promise<string> {
  const old = fiberOf(tree.store[id])
  await tree.update(id, { disabled: true })
  await settleFiber(old, settleMs)
  await tree.update(id, { disabled: null })
  const entry = tree.store[id]
  await settleFiber(fiberOf(entry), settleMs)
  return fiberStateOf(entry)
}

/** 在调用方的 await 链里重新加载一条，操作条目树时抛错就记为 `failed` */
export async function remountNow(tree: EntryTreeLike, id: string, log: RemountLog, settleMs: number = SETTLE_MS): Promise<RemountedEntry> {
  try {
    const state = await remountEntry(tree, id, settleMs)
    log.info(`条目 ${id} 重新加载了：${state}`)
    return { id, action: 'remounted', state }
  } catch (err: unknown) {
    log.warn(`条目 ${id} 重新加载失败：${String(err)}`)
    return { id, action: 'failed', state: String(err) }
  }
}

function fiberOf(entry: unknown): unknown {
  return isRecord(entry) ? entry['fiber'] : undefined
}
