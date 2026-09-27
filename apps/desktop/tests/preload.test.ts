import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

/** preload.cjs 在沙箱里运行，只能 require('electron')；这里把它的源码交给一个假的 require 求值 */

interface ExposedGwb {
  request(channel: string, payload?: unknown): Promise<unknown>
  prepareImports(required?: string[]): Promise<void>
  command(command: string, args?: unknown): Promise<unknown>
  on(callback: (payload: unknown) => void): () => void
  onShell(callback: (shell: unknown) => void): () => void
}

function loadPreload() {
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'preload.cjs'), 'utf8')
  const ipcRenderer = fakeIpcRenderer()
  const scripts: { type: string; textContent: string }[] = []
  const document = {
    createElement: () => ({ type: '', textContent: '' }),
    head: { appendChild: (script: { type: string; textContent: string }) => scripts.push(script) },
  }
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
  const evaluatePreload = new vm.Script(`(function (require, document) {
${source}
})`, { filename: 'preload.cjs' }).runInThisContext() as (require: unknown, document: unknown) => void
  evaluatePreload(fakeRequire, document)
  return { gwb: exposed as ExposedGwb, exposedName, ipcRenderer, scripts }
}

function fakeIpcRenderer() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  return {
    listeners,
    invoke: vi.fn(async (...args: unknown[]): Promise<unknown> => ({ invoked: args })),
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
  it('等待主进程快照并注入后才就绪；重复准备不重复注表，后来登记的新名字可以追加', async () => {
    const { gwb, ipcRenderer, scripts } = loadPreload()
    ipcRenderer.invoke.mockResolvedValue({ runtime: 'file:///runtime.js' })
    await gwb.prepareImports(['runtime'])
    expect(scripts).toEqual([{ type: 'importmap', textContent: JSON.stringify({ imports: { runtime: 'file:///runtime.js' } }) }])
    await gwb.prepareImports()
    expect(scripts).toHaveLength(1)
    ipcRenderer.invoke.mockResolvedValue({ runtime: 'file:///runtime.js', late: 'file:///late.js' })
    await gwb.prepareImports(['late'])
    expect(JSON.parse(scripts[1]!.textContent)).toEqual({ imports: { late: 'file:///late.js' } })
  })

  it('未登记的依赖失败后可重试；已注入的地址变化或撤销时要求整页重载，不注入半张表', async () => {
    const { gwb, ipcRenderer, scripts } = loadPreload()
    ipcRenderer.invoke.mockResolvedValue({})
    await expect(gwb.prepareImports(['runtime'])).rejects.toThrow(/runtime/)
    ipcRenderer.invoke.mockResolvedValue({ runtime: 'file:///v1.js' })
    await gwb.prepareImports(['runtime'])
    ipcRenderer.invoke.mockResolvedValue({ fresh: 'file:///fresh.js', runtime: 'file:///v2.js' })
    await expect(gwb.prepareImports()).rejects.toThrow(/重载/)
    expect(scripts).toHaveLength(1)
    ipcRenderer.invoke.mockResolvedValue({})
    await expect(gwb.prepareImports()).rejects.toThrow(/重载/)
  })

  it('只在页面上放一个 window.gwb，提供命令、事件、外壳订阅与模块准备', () => {
    const { gwb, exposedName } = loadPreload()
    expect(exposedName).toBe('gwb')
    expect(Object.keys(gwb).sort()).toEqual(['command', 'on', 'onShell', 'prepareImports', 'request'])
  })

  it('command 经 gwb:command 调到主进程，回执原样交回', async () => {
    const { gwb, ipcRenderer } = loadPreload()
    expect(await gwb.command('demo.hello', { a: 1 })).toEqual({ invoked: ['gwb:command', 'demo.hello', { a: 1 }] })
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('gwb:command', 'demo.hello', { a: 1 })
  })

  it('request 解开传输状态而不改业务回执；仅未登记转换为稳定的不可用错误', async () => {
    const { gwb, ipcRenderer } = loadPreload()
    ipcRenderer.invoke.mockResolvedValue({ available: true, value: { available: false } })
    expect(await gwb.request('sample', 42)).toEqual({ available: false })
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('gwb:request', 'sample', 42)
    ipcRenderer.invoke.mockResolvedValue({ available: false })
    await expect(gwb.request('sample')).rejects.toThrow('GWB_REQUEST_UNAVAILABLE: sample')
    ipcRenderer.invoke.mockRejectedValue(new Error('connection closed'))
    await expect(gwb.request('sample')).rejects.toThrow('connection closed')
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
    ipcRenderer.emit('gwb:shell', { url: null, report: {} })
    expect(received).toEqual([{ url: null, report: {} }])
    unsubscribe()
    expect(ipcRenderer.listeners.get('gwb:shell')?.size).toBe(0)
  })
})
