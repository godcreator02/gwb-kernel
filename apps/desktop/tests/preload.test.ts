import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

/** preload.cjs 在沙箱里运行，只能 require('electron')；这里把它的源码交给一个假的 require 求值 */

interface ExposedGwb {
  command(command: string, args?: unknown): Promise<unknown>
  on(callback: (payload: unknown) => void): () => void
  onShell(callback: (shell: unknown) => void): () => void
}

function loadPreload(): { gwb: ExposedGwb; exposedName: string; ipcRenderer: ReturnType<typeof fakeIpcRenderer> } {
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'preload.cjs'), 'utf8')
  const ipcRenderer = fakeIpcRenderer()
  let exposedName = ''
  let exposed: unknown
  const electron = {
    contextBridge: {
      exposeInMainWorld: (name: string, api: unknown) => {
        exposedName = name
        exposed = api
      },
    },
    ipcRenderer,
  }
  const fakeRequire = (id: string): unknown => {
    if (id !== 'electron') throw new Error(`preload 只该 require electron，收到 ${id}`)
    return electron
  }
  const evaluatePreload = new vm.Script(`(function (require) {
${source}
})`, { filename: 'preload.cjs' }).runInThisContext() as (require: unknown) => void
  evaluatePreload(fakeRequire)
  return { gwb: exposed as ExposedGwb, exposedName, ipcRenderer }
}

function fakeIpcRenderer() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  return {
    listeners,
    invoke: vi.fn(async (...args: unknown[]) => ({ invoked: args })),
    send: vi.fn(),
    on(channel: string, listener: (...args: unknown[]) => void) {
      if (!listeners.has(channel)) listeners.set(channel, new Set())
      listeners.get(channel)!.add(listener)
    },
    off(channel: string, listener: (...args: unknown[]) => void) {
      listeners.get(channel)?.delete(listener)
    },
    emit(channel: string, payload: unknown) {
      for (const listener of listeners.get(channel) ?? []) listener({ sender: 'ipc-event' }, payload)
    },
  }
}

describe('preload.cjs', () => {
  it('只在页面上放一个 window.gwb，上面正好三个函数', () => {
    const { gwb, exposedName } = loadPreload()
    expect(exposedName).toBe('gwb')
    expect(Object.keys(gwb).sort()).toEqual(['command', 'on', 'onShell'])
  })

  it('command 经 gwb:command 调到主进程，回执原样交回', async () => {
    const { gwb, ipcRenderer } = loadPreload()
    expect(await gwb.command('demo.hello', { a: 1 })).toEqual({ invoked: ['gwb:command', 'demo.hello', { a: 1 }] })
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('gwb:command', 'demo.hello', { a: 1 })
  })

  it('on 订阅 gwb:event，回调只收到 payload；返回的函数取消的正是这一个订阅', () => {
    const { gwb, ipcRenderer } = loadPreload()
    const received: unknown[] = []
    const unsubscribe = gwb.on((payload) => received.push(payload))
    ipcRenderer.emit('gwb:event', { hello: 1 })
    expect(received).toEqual([{ hello: 1 }])
    unsubscribe()
    ipcRenderer.emit('gwb:event', { hello: 2 })
    expect(received).toEqual([{ hello: 1 }])
    expect(ipcRenderer.listeners.get('gwb:event')?.size).toBe(0)
  })

  it('onShell 订阅 gwb:shell 之后马上发一次 gwb:hello 问当前值；返回的函数取消订阅', () => {
    const { gwb, ipcRenderer } = loadPreload()
    const received: unknown[] = []
    const unsubscribe = gwb.onShell((shell) => received.push(shell))
    expect(ipcRenderer.listeners.get('gwb:shell')?.size).toBe(1)
    expect(ipcRenderer.send).toHaveBeenCalledWith('gwb:hello')
    ipcRenderer.emit('gwb:shell', { url: null, imports: {}, report: {} })
    expect(received).toEqual([{ url: null, imports: {}, report: {} }])
    unsubscribe()
    expect(ipcRenderer.listeners.get('gwb:shell')?.size).toBe(0)
  })
})
