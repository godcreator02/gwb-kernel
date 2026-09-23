import type { GwbContext } from '@godcreator/gwb-plugin-api'
// 只取类型：loader 的 EntryTree，以及它给 cordis 的 Fiber 补上的 entry 字段。产物里没有这个包名，d.ts 里也没有
import type { EntryTree } from '@cordisjs/plugin-loader'
import { isRecord } from './vocab.js'

/**
 * 承载 `cordis.yml` 的那棵条目树。
 *
 * **改 cordis.yml 只有这一条路，不许自己写文件。** loader 把「磁盘上的 yml」与「内存里
 * 已加载的条目」绑在一起：`tree.create` 一次做完——把 options 放进 group、写回 yml、
 * 立即加载。绕过它自己写 yml，内存里的那份不知道，改动要等下次重启才生效，而
 * 中间任何一次 `write()` 都会用旧的内存状态把磁盘上的覆盖回去。
 *
 * **写入磁盘推迟到下一个宏任务**：include 插件的 `write()` 只排一个 `setTimeout(0)`，序列化
 * 的是那时的内存状态。所以这几个方法返回时磁盘上还是旧的——**别在调用之后读回 yml
 * 去「确认改成了」**，那样读到的必然是上一版。内存里的条目树才是当前的真实状态。
 */

/**
 * loader 的 `EntryTree` 收窄到用得着的那几样。`treeOf` 里把 loader 的树直接赋给它：loader 改了这几个
 * 方法的签名，类型检查就在那里失败。对外的类型只用这份收窄，使用方不需要装 loader
 */
export interface EntryTreeLike {
  /** 不带前缀的 id → Entry 的表，不分层。同一棵树里的分组也在这张表上，没有嵌套 */
  store: Record<string, unknown>
  /** 加一条：写回 yml + 立即加载。`parent` 给 null 就是放在 yml 顶层 */
  create(options: Record<string, unknown>, parent?: string | null, position?: number): Promise<string>
  /** 删除一条 + 写回 yml */
  remove(id: string): void
  /** 改 options + 写回 yml。值给 null 是**删掉那个字段** */
  update(id: string, options: Record<string, unknown>, parent?: string | null, position?: number): Promise<void>
  /** 取一条。**只认不带前缀的 id**——传入完整 entryId 会直接抛错 */
  resolve(id: string): unknown
}

/** 那四个方法都在才算一棵树。少一个就立即说清楚——比后面某一步莫名其妙地失败好排查 */
export function asTree(candidate: unknown): EntryTreeLike {
  if (!isRecord(candidate)) {
    throw new Error('取不到承载 cordis.yml 的条目树——config.home 指的那条条目还没加载完，或者它不是 include。')
  }
  for (const key of ['create', 'remove', 'update', 'resolve']) {
    if (typeof candidate[key] !== 'function') {
      throw new Error(`条目树上没有 ${key}()——loader 的接口变了，这个插件要跟着改。`)
    }
  }
  return candidate as unknown as EntryTreeLike
}

/**
 * 承载 `cordis.yml` 的那棵树：在本插件自己条目所在的那一层（loader 根层），按 `homeEntryId` 找到那条
 * include 条目，取它的子树。`homeEntryId` 由内核经 config 给出，本插件不猜它叫什么。
 *
 * **用到时再取，不在构造时取**：内核把本插件排在 include 条目之前加载，apply 那一刻子树还没建好。
 * `ctx` 要用本插件自己的（构造时保存的那个）；用调用方的会取到别人条目所在的那一层。
 */
export function treeOf(ctx: GwbContext, homeEntryId: string): EntryTreeLike {
  const layer: EntryTree | undefined = ctx.fiber.entry?.parent.tree
  if (layer === undefined) {
    throw new Error('取不到插件管理自己的条目——它要作为 loader 的条目加载（内核把它放在 loader 根层），不能直接用 ctx.plugin 加载。')
  }
  const tree: EntryTree | undefined = layer.resolve(homeEntryId).subtree
  const narrowed: EntryTreeLike | undefined = tree
  return asTree(narrowed)
}
