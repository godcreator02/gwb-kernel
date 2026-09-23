import { describe, expect, it } from 'vitest'
import { remountNow, type RemountLog } from '../src/remount.js'
import type { EntryTreeLike } from '../src/tree.js'

/**
 * `remount` 一次：停用 → 等卸载完 → 启用 → 等加载完。条目树是假的：停用把 fiber 置成 DISPOSED 并
 * 去掉，启用新建一个 ACTIVE 的 fiber——跟 loader 的 update 同一个形状。
 */

const ACTIVE = 2
const DISPOSED = 4

interface FakeFiber {
  state: number
  await: () => Promise<void>
}

function fiber(): FakeFiber {
  return { state: ACTIVE, await: () => Promise.resolve() }
}

interface FakeTree extends EntryTreeLike {
  /** 按发生顺序记下每一次 update：`<id> off` / `<id> on` */
  calls: string[]
}

function fakeTree(ids: readonly string[]): FakeTree {
  const store = Object.create(null) as Record<string, { disabled: boolean; fiber: FakeFiber | undefined }>
  for (const id of ids) store[id] = { disabled: false, fiber: fiber() }
  const calls: string[] = []
  return {
    store,
    calls,
    create: () => Promise.reject(new Error('不该调')),
    remove: () => undefined,
    resolve: (id) => store[id],
    update: (id, options) => {
      const entry = store[id]
      if (entry === undefined) return Promise.reject(new Error(`cannot resolve entry ${id}`))
      if (options['disabled'] === true) {
        calls.push(`${id} off`)
        entry.disabled = true
        if (entry.fiber !== undefined) entry.fiber.state = DISPOSED
        entry.fiber = undefined
      } else if (options['disabled'] === null) {
        calls.push(`${id} on`)
        entry.disabled = false
        entry.fiber = fiber()
      }
      return Promise.resolve()
    },
  }
}

function quietLog(): RemountLog & { lines: string[] } {
  const lines: string[] = []
  return { lines, info: (m) => lines.push(m), warn: (m) => lines.push(`warn ${m}`) }
}

describe('remountNow：在这条命令里做完', () => {
  it('停用再启用，回 remounted 和重新加载后的状态', async () => {
    const tree = fakeTree(['hello'])
    const result = await remountNow(tree, 'hello', quietLog(), 10)
    expect(result).toEqual({ id: 'hello', action: 'remounted', state: 'ACTIVE' })
    expect(tree.calls).toEqual(['hello off', 'hello on'])
  })

  it('原本停用的条目：最后是启用的', async () => {
    const tree = fakeTree(['hello'])
    await tree.update('hello', { disabled: true })
    tree.calls.length = 0
    const result = await remountNow(tree, 'hello', quietLog(), 10)
    expect(result).toEqual({ id: 'hello', action: 'remounted', state: 'ACTIVE' })
  })

  it('动条目树时抛了：回 failed，state 里是那句错', async () => {
    const tree = fakeTree([])
    const result = await remountNow(tree, 'ghost', quietLog(), 10)
    expect(result.action).toBe('failed')
    expect(result.state).toContain('cannot resolve entry ghost')
  })
})
