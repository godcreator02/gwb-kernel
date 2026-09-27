import type { GwbRequestHandler } from './api.js'

function checkChannel(channel: unknown): asserts channel is string {
  if (typeof channel !== 'string' || channel.trim() === '') throw new Error('请求通道必须是非空字符串')
}

/** available 是 IPC 内部的传输状态，与插件返回值隔开，避免解释或改写业务回执。 */
type RequestReply = { available: false } | { available: true; value: unknown }

export function createRequests() {
  const handlers = new Map<string, GwbRequestHandler>()
  return {
    handle(channel: string, handler: GwbRequestHandler): () => void {
      checkChannel(channel)
      if (typeof handler !== 'function') throw new Error('请求处理器必须是函数')
      if (handlers.has(channel)) throw new Error(`请求通道已登记：${channel}`)
      handlers.set(channel, handler)
      let revoked = false
      return () => {
        if (revoked) return
        revoked = true
        handlers.delete(channel)
      }
    },
    async dispatch(channel: unknown, payload: unknown): Promise<RequestReply> {
      checkChannel(channel)
      const handler = handlers.get(channel)
      if (handler === undefined) return { available: false }
      return { available: true, value: await handler(payload) }
    },
  }
}
