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
 * loader 的 `EntryTree` 收窄到用得着的那几样。内核取 `ctx.loader.resolve('home').subtree` 经 config 交来，
 * 交来的就是 loader 的那棵树。对外的类型只用这份收窄，使用方不需要装 loader
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
    throw new Error('内核没有经 config.tree 交来承载 cordis.yml 的条目树——这个插件由内核在加载 cordis.yml 之前直接加载，树由内核交给它。')
  }
  for (const key of ['create', 'remove', 'update', 'resolve']) {
    if (typeof candidate[key] !== 'function') {
      throw new Error(`条目树上没有 ${key}()——loader 的接口变了，这个插件要跟着改。`)
    }
  }
  return candidate as unknown as EntryTreeLike
}
