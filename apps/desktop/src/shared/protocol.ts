/**
 * 主进程 ↔ 宿主子进程的行协议：一行一条 JSON。
 * 命令下行走 stdin，宿主上行走 fd3（fd1 留给宿主自己的日志，混在一起就没法读）。
 * 两头都从这里取形状与解析——各拼各的必然漂开。
 */

/** 主进程 → 宿主 */
export interface CommandLine {
  t: 'command'
  id: string
  payload: { command: string; args?: unknown }
}

/** 宿主 → 主进程 */
export type HostMessage =
  | { t: 'ready' }
  | { t: 'reply'; id: string; result: unknown }
  | { t: 'event'; payload: unknown }

function asObject(line: string): Record<string, unknown> | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
  return parsed as Record<string, unknown>
}

export function parseHostLine(line: string): HostMessage | undefined {
  const msg = asObject(line)
  if (msg === undefined) return undefined
  if (msg.t === 'ready') return { t: 'ready' }
  if (msg.t === 'event') return { t: 'event', payload: msg.payload }
  if (msg.t === 'reply' && typeof msg.id === 'string') return { t: 'reply', id: msg.id, result: msg.result }
  return undefined
}

export function parseCommandLine(line: string): CommandLine | undefined {
  const msg = asObject(line)
  if (msg === undefined || msg.t !== 'command' || typeof msg.id !== 'string') return undefined
  const payload = msg.payload
  if (payload === null || typeof payload !== 'object') return undefined
  const { command, args } = payload as { command?: unknown; args?: unknown }
  if (typeof command !== 'string') return undefined
  return { t: 'command', id: msg.id, payload: { command, args } }
}
