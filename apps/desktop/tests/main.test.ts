import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { GwbKernelApi } from '../src/api.js'

/**
 * main.ts 的行为锁：electron 换成假的，cordis、loader、include 用真的，home 是临时目录。
 * 每个用例重新求值一次 main.ts（vi.resetModules），模块求值时注册的进程监听在用例结束时摘掉
 */

const harness = vi.hoisted(() => ({ electron: {} as Record<string, unknown> }))
vi.mock('electron', () => ({
  default: new Proxy({}, { get: (_target, key: string) => harness.electron[key] }),
}))

interface ProbeRecord {
  kernel?: GwbKernelApi
  logger?: { error(message: string): void; warn(message: string): void }
  events: string[]
}
const probeGlobal = globalThis as typeof globalThis & { __gwbMainTestProbe?: ProbeRecord }

const kernelPackageVersion = (
  JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8')) as { version: string }
).version

interface FakeWindow {
  options: Record<string, unknown>
  events: EventEmitter
  webContents: {
    send: Mock
    events: EventEmitter
    on(event: string, listener: (...args: unknown[]) => void): void
    windowOpenHandler?: (details: { url: string }) => unknown
    setWindowOpenHandler(handler: (details: { url: string }) => unknown): void
    getURL(): string
  }
  show: Mock
  focus: Mock
  loadFile: Mock
}

interface FakeElectron {
  module: Record<string, unknown>
  appEvents: EventEmitter
  resolveReady(): void
  setPath: Mock
  exit: Mock
  quit: Mock
  setApplicationMenu: Mock
  showErrorBox: Mock
  openExternal: Mock
  windows: FakeWindow[]
  ipcHandlers: Map<string, (...args: unknown[]) => unknown>
  ipcListeners: Map<string, (...args: unknown[]) => unknown>
}

interface FakeElectronOptions {
  appData: string
  singleInstanceLockGranted?: boolean
  remoteDebuggingPort?: string
  loadFileFails?: boolean
  openExternalFails?: boolean
}

function makeFakeElectron(options: FakeElectronOptions): FakeElectron {
  const appEvents = new EventEmitter()
  let resolveReady = (): void => {}
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const windows: FakeWindow[] = []
  const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>()
  const ipcListeners = new Map<string, (...args: unknown[]) => unknown>()
  const setPath = vi.fn()
  const exit = vi.fn()
  const quit = vi.fn()
  const setApplicationMenu = vi.fn()
  const showErrorBox = vi.fn()
  const openExternal = vi.fn(async () => {
    if (options.openExternalFails === true) throw new Error('系统浏览器打不开（测试造的）')
  })

  class BrowserWindow implements FakeWindow {
    options: Record<string, unknown>
    events = new EventEmitter()
    webContents = {
      send: vi.fn(),
      events: new EventEmitter(),
      on(event: string, listener: (...args: unknown[]) => void): void {
        this.events.on(event, listener)
      },
      windowOpenHandler: undefined as ((details: { url: string }) => unknown) | undefined,
      setWindowOpenHandler(handler: (details: { url: string }) => unknown): void {
        this.windowOpenHandler = handler
      },
      getURL: (): string => FAKE_PAGE_URL,
    }
    show = vi.fn()
    focus = vi.fn()
    loadFile = vi.fn(async () => {
      if (options.loadFileFails === true) throw new Error('loadFile 失败（测试造的）')
    })
    constructor(windowOptions: Record<string, unknown>) {
      this.options = windowOptions
      windows.push(this)
    }
    once(event: string, listener: (...args: unknown[]) => void): void {
      this.events.once(event, listener)
    }
    on(event: string, listener: (...args: unknown[]) => void): void {
      this.events.on(event, listener)
    }
  }

  const app = {
    getPath: (name: string): string => {
      if (name !== 'appData') throw new Error(`假 electron 没有 ${name}`)
      return options.appData
    },
    setPath,
    requestSingleInstanceLock: (): boolean => options.singleInstanceLockGranted ?? true,
    exit,
    quit,
    commandLine: {
      getSwitchValue: (name: string): string => (name === 'remote-debugging-port' ? (options.remoteDebuggingPort ?? '') : ''),
    },
    on: (event: string, listener: (...args: unknown[]) => void): void => {
      appEvents.on(event, listener)
    },
    whenReady: (): Promise<void> => ready,
  }

  return {
    module: {
      app,
      BrowserWindow,
      Menu: { setApplicationMenu },
      dialog: { showErrorBox },
      shell: { openExternal },
      ipcMain: {
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => ipcHandlers.set(channel, handler),
        on: (channel: string, listener: (...args: unknown[]) => unknown) => ipcListeners.set(channel, listener),
      },
    },
    appEvents,
    resolveReady: () => resolveReady(),
    setPath,
    exit,
    quit,
    setApplicationMenu,
    showErrorBox,
    openExternal,
    windows,
    ipcHandlers,
    ipcListeners,
  }
}

const FAKE_PAGE_URL = 'file:///C:/fake-app-dir/dist/index.html'
const topFrameEvent = { senderFrame: { parent: null } }

const temporaryDirs: string[] = []
const openedDescriptors: number[] = []
let processListenersAddedByMain: [string, (...args: unknown[]) => void][] = []
const stderrEventsWatched = ['error'] as const

function makeTemporaryDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temporaryDirs.push(dir)
  return dir
}

function writeFiles(root: string, files: Record<string, string>): void {
  for (const [relative, text] of Object.entries(files)) {
    const target = path.join(root, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text)
  }
}

function listenerSnapshot(): Map<string, Set<unknown>> {
  const snapshot = new Map<string, Set<unknown>>()
  snapshot.set('process:unhandledRejection', new Set(process.listeners('unhandledRejection')))
  snapshot.set('process:uncaughtException', new Set(process.listeners('uncaughtException')))
  for (const event of stderrEventsWatched) snapshot.set(`stderr:${event}`, new Set(process.stderr.listeners(event)))
  return snapshot
}

function listenersAddedSince(before: Map<string, Set<unknown>>): [string, (...args: unknown[]) => void][] {
  const added: [string, (...args: unknown[]) => void][] = []
  const after = listenerSnapshot()
  for (const [key, listeners] of after) {
    for (const listener of listeners) {
      if (!before.get(key)?.has(listener)) added.push([key, listener as (...args: unknown[]) => void])
    }
  }
  return added
}

interface BootOptions extends Omit<FakeElectronOptions, 'appData'> {
  gwbHome: string
  appData?: string
  resolveReady?: boolean
}

interface BootedKernel {
  electron: FakeElectron
  dataDir: string
  readLog(): string
}

async function importMain(options: BootOptions): Promise<BootedKernel> {
  const appData = options.appData ?? makeTemporaryDir('gwb-main-appdata-')
  const electron = makeFakeElectron({ ...options, appData })
  harness.electron = electron.module
  process.env.GWB_HOME = options.gwbHome
  const before = listenerSnapshot()
  vi.resetModules()
  await import('../src/main')
  processListenersAddedByMain = listenersAddedSince(before)
  const homePath = /[\\/]/.test(options.gwbHome) ? path.resolve(options.gwbHome) : path.join(appData, 'gwb-kernel', 'homes', options.gwbHome)
  const dataDir = fs.realpathSync.native(homePath)
  const logFile = path.join(dataDir, 'gwb.log')
  const booted: BootedKernel = {
    electron,
    dataDir,
    readLog: () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : ''),
  }
  if (options.resolveReady === true) electron.resolveReady()
  return booted
}

async function bootUntilUp(options: BootOptions): Promise<BootedKernel> {
  const booted = await importMain({ ...options, resolveReady: true })
  await vi.waitFor(() => expect(booted.readLog()).toContain('info kernel up，home='), { timeout: 10_000 })
  return booted
}

function fakeHomeWithPlugins(): string {
  const home = makeTemporaryDir('gwb-main-home-')
  writeFiles(home, {
    'package.json': JSON.stringify({ name: 'gwb-home', private: true }),
    'cordis.yml': '- id: probe\n  name: gwb-test-probe\n- id: commands\n  name: gwb-test-commands\n',
    'node_modules/gwb-test-probe/package.json': JSON.stringify({ name: 'gwb-test-probe', type: 'module', exports: { '.': './index.mjs' } }),
    'node_modules/gwb-test-probe/index.mjs': [
      "export const name = 'gwb-test-probe'",
      'export function apply(ctx) {',
      '  const probe = globalThis.__gwbMainTestProbe',
      '  probe.kernel = ctx.gwbKernel',
      "  probe.logger = ctx.logger('probe')",
      "  ctx.effect(() => () => { probe.events.push('probe disposed') })",
      '}',
      '',
    ].join('\n'),
    'node_modules/gwb-test-commands/package.json': JSON.stringify({ name: 'gwb-test-commands', type: 'module', exports: { '.': './index.mjs' } }),
    'node_modules/gwb-test-commands/index.mjs': [
      "export const name = 'gwb-test-commands'",
      'export function apply(ctx) {',
      "  ctx.provide('gwbCommands', { run: async (command, args, context) => ({ ok: true, data: { command, args, context } }) })",
      '}',
      '',
    ].join('\n'),
  })
  return home
}

function shellMessagesSent(window: FakeWindow): { url: string | null; report: { home: string; entries: { id: string; name: string; state: string }[]; errors: string[] } }[] {
  return window.webContents.send.mock.calls.filter((call) => call[0] === 'gwb:shell').map((call) => call[1] as never)
}

async function quitAndWaitForCleanup(booted: BootedKernel): Promise<{ preventDefault: Mock }> {
  const willQuitEvent = { preventDefault: vi.fn() }
  booted.electron.appEvents.emit('will-quit', willQuitEvent)
  await vi.waitFor(() => expect(booted.electron.quit).toHaveBeenCalled(), { timeout: 10_000 })
  return willQuitEvent
}

const realOpenSync = fs.openSync.bind(fs)
vi.spyOn(fs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
  const descriptor = realOpenSync(...args)
  if (String(args[0]).endsWith('gwb.log')) openedDescriptors.push(descriptor)
  return descriptor
})

let stderrWrite: { mockRestore(): void } | undefined
function silenceStderr(): void {
  stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
}

afterEach(() => {
  for (const [key, listener] of processListenersAddedByMain) {
    const [target, event] = key.split(':') as ['process' | 'stderr', string]
    if (target === 'process') process.removeListener(event, listener)
    else process.stderr.removeListener(event, listener)
  }
  processListenersAddedByMain = []
  stderrWrite?.mockRestore()
  stderrWrite = undefined
  delete process.env.GWB_HOME
  delete probeGlobal.__gwbMainTestProbe
  // main.ts 退出时不关日志文件，这里替它关，临时目录才删得掉
  for (const descriptor of openedDescriptors.splice(0)) fs.closeSync(descriptor)
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('main.ts：home 的准备', () => {
  it('GWB_HOME 带路径分隔符就当目录本身；缺 package.json、cordis.yml 时补最小形态；userData 设在 <home>/electron', async () => {
    silenceStderr()
    const home = path.join(makeTemporaryDir('gwb-main-root-'), 'fresh-home')
    const booted = await importMain({ gwbHome: home })
    expect(fs.readFileSync(path.join(booted.dataDir, 'package.json'), 'utf8')).toBe('{\n  "name": "gwb-home",\n  "private": true\n}\n')
    expect(fs.readFileSync(path.join(booted.dataDir, 'cordis.yml'), 'utf8')).toBe('[]\n')
    expect(booted.electron.setPath).toHaveBeenCalledWith('userData', path.join(booted.dataDir, 'electron'))
  })

  it('GWB_HOME 只写名字就放在 appData/gwb-kernel/homes/<名字>；已有的 package.json 不覆盖', async () => {
    silenceStderr()
    const appData = makeTemporaryDir('gwb-main-appdata-')
    const homePath = path.join(appData, 'gwb-kernel', 'homes', 'named-home')
    writeFiles(homePath, { 'package.json': '{"name":"mine"}' })
    const booted = await importMain({ gwbHome: 'named-home', appData })
    expect(booted.dataDir).toBe(fs.realpathSync.native(homePath))
    expect(fs.readFileSync(path.join(booted.dataDir, 'package.json'), 'utf8')).toBe('{"name":"mine"}')
    expect(fs.readFileSync(path.join(booted.dataDir, 'cordis.yml'), 'utf8')).toBe('[]\n')
  })
})

describe('main.ts：单实例锁与 runtime.json', () => {
  it('拿不到单实例锁：日志写明已有实例在运行，退出码 1', async () => {
    silenceStderr()
    const booted = await importMain({ gwbHome: makeTemporaryDir('gwb-main-home-'), singleInstanceLockGranted: false })
    expect(booted.readLog()).toContain(`error kernel home ${booted.dataDir} 已有实例在运行，本实例退出`)
    expect(booted.electron.exit).toHaveBeenCalledWith(1)
  })

  it('runtime.json 每次启动整份重写：pid、启动时刻、版本；没开调试端口就没有 cdp', async () => {
    silenceStderr()
    const home = makeTemporaryDir('gwb-main-home-')
    writeFiles(home, { 'runtime.json': '{"stale":true}' })
    const before = Date.now()
    const booted = await importMain({ gwbHome: home })
    const runtime = JSON.parse(fs.readFileSync(path.join(booted.dataDir, 'runtime.json'), 'utf8')) as Record<string, unknown>
    expect(Object.keys(runtime).sort()).toEqual(['pid', 'startedAt', 'version'])
    expect(runtime['pid']).toBe(process.pid)
    expect(runtime['version']).toBe(kernelPackageVersion)
    expect(runtime['startedAt']).toBeGreaterThanOrEqual(before)
    expect(fs.readFileSync(path.join(booted.dataDir, 'runtime.json'), 'utf8').endsWith('}\n')).toBe(true)
  })

  it('开了合法的调试端口就写 cdp；不是 1–65535 的整数就不写', async () => {
    silenceStderr()
    const withPort = await importMain({ gwbHome: makeTemporaryDir('gwb-main-home-'), remoteDebuggingPort: '9222' })
    expect(JSON.parse(fs.readFileSync(path.join(withPort.dataDir, 'runtime.json'), 'utf8'))).toMatchObject({ cdp: 9222 })
    for (const badPort of ['abc', '0', '65536', '1.5']) {
      const booted = await importMain({ gwbHome: makeTemporaryDir('gwb-main-home-'), remoteDebuggingPort: badPort })
      expect(JSON.parse(fs.readFileSync(path.join(booted.dataDir, 'runtime.json'), 'utf8'))).not.toHaveProperty('cdp')
    }
  })

  it('第二个实例启动时把已打开的窗口调到前面；还没有窗口时什么都不做', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const window = booted.electron.windows[0]!
    booted.electron.appEvents.emit('second-instance')
    expect(window.show).toHaveBeenCalled()
    expect(window.focus).toHaveBeenCalled()
    window.events.emit('closed')
    expect(() => booted.electron.appEvents.emit('second-instance')).not.toThrow()
    await quitAndWaitForCleanup(booted)
  })
})

describe('main.ts：启动', () => {
  it('ready 之后：去掉默认菜单、开一个暗底不闪白的窗口、加载 index.html，加载完写 up 一行', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    expect(booted.electron.setApplicationMenu).toHaveBeenCalledWith(null)
    expect(booted.electron.windows).toHaveLength(1)
    const window = booted.electron.windows[0]!
    expect(window.options).toMatchObject({ width: 1100, height: 720, backgroundColor: '#151518', show: false })
    expect(String((window.options['webPreferences'] as { preload: string }).preload)).toMatch(/preload\.cjs$/)
    expect(String(window.loadFile.mock.calls[0]?.[0])).toMatch(/index\.html$/)
    window.events.emit('ready-to-show')
    expect(window.show).toHaveBeenCalled()
    expect(booted.readLog()).toContain(`info kernel up，home=${booted.dataDir}，外壳=`)
    await quitAndWaitForCleanup(booted)
  })

  it('启动失败：写一行 error、弹错误框（带 gwb.log 路径）、退出码 1', async () => {
    silenceStderr()
    const booted = await importMain({ gwbHome: makeTemporaryDir('gwb-main-home-'), loadFileFails: true, resolveReady: true })
    await vi.waitFor(() => expect(booted.electron.exit).toHaveBeenCalledWith(1), { timeout: 10_000 })
    expect(booted.readLog()).toMatch(/error kernel .*loadFile 失败（测试造的）/)
    const [title, body] = booted.electron.showErrorBox.mock.calls[0] as [string, string]
    expect(title).toBe('gwb 启动失败')
    expect(body).toContain('loadFile 失败（测试造的）')
    expect(body).toContain(path.join(booted.dataDir, 'gwb.log'))
  })

  it('页面 console 进 cordis 日志，名字是 renderer，warning 记成 warn', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const window = booted.electron.windows[0]!
    window.webContents.events.emit('console-message', { level: 'warning', message: '页面说了一句警告' })
    window.webContents.events.emit('console-message', { level: 'error', message: '页面说了一句错误' })
    window.webContents.events.emit('console-message', { level: 'debug', message: '页面说了一句调试' })
    window.webContents.events.emit('console-message', { level: 'info', message: '页面说了一句普通话' })
    const log = booted.readLog()
    expect(log).toContain('warn renderer 页面说了一句警告')
    expect(log).toContain('error renderer 页面说了一句错误')
    expect(log).toContain('debug renderer 页面说了一句调试')
    expect(log).toContain('info renderer 页面说了一句普通话')
    await quitAndWaitForCleanup(booted)
  })

  it('页面边界：主框架跳到别处（包括 http、https）、主框架的重定向一律拒绝并记一行 warn；整页重新加载放行', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const webContents = booted.electron.windows[0]!.webContents
    const navigationTo = (url: string, extra: Record<string, unknown> = {}) => ({ url, preventDefault: vi.fn(), ...extra })

    const draggedLink = navigationTo('https://example.com/')
    webContents.events.emit('will-navigate', draggedLink)
    expect(draggedLink.preventDefault).toHaveBeenCalled()
    const reload = navigationTo(`${FAKE_PAGE_URL}#/somewhere`)
    webContents.events.emit('will-navigate', reload)
    expect(reload.preventDefault).not.toHaveBeenCalled()

    const mainFrameRedirect = navigationTo('https://example.com/elsewhere', { isMainFrame: true })
    webContents.events.emit('will-redirect', mainFrameRedirect)
    expect(mainFrameRedirect.preventDefault).toHaveBeenCalled()
    const iframeRedirect = navigationTo('https://example.com/elsewhere', { isMainFrame: false })
    webContents.events.emit('will-redirect', iframeRedirect)
    expect(iframeRedirect.preventDefault).not.toHaveBeenCalled()

    expect(booted.electron.openExternal).not.toHaveBeenCalled()
    const log = booted.readLog()
    expect(log).toContain('warn kernel 页面只能是内核的 index.html，拒绝主框架跳转到 https://example.com/')
    expect(log).toContain('warn kernel 页面只能是内核的 index.html，拒绝主框架重定向到 https://example.com/elsewhere')
    await quitAndWaitForCleanup(booted)
  })

  it('window.open：窗口一律 deny；http、https 交给系统浏览器并记一行 info，别的协议拒绝并记一行 warn', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const webContents = booted.electron.windows[0]!.webContents

    expect(webContents.windowOpenHandler?.({ url: 'https://example.com/popup' })).toEqual({ action: 'deny' })
    expect(webContents.windowOpenHandler?.({ url: 'file:///C:/Users/me/Desktop/notes.html' })).toEqual({ action: 'deny' })
    expect(booted.electron.openExternal).toHaveBeenCalledTimes(1)
    expect(booted.electron.openExternal).toHaveBeenCalledWith('https://example.com/popup')

    const log = booted.readLog()
    expect(log).toContain('info kernel 交给系统浏览器打开 https://example.com/popup')
    expect(log).toContain('warn kernel 页面只能是内核的 index.html，拒绝打开新窗口 file:///C:/Users/me/Desktop/notes.html')
    await quitAndWaitForCleanup(booted)
  })

  it('window.open：系统浏览器打开失败只记一行 warn（带地址与错误），不抛', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-'), openExternalFails: true })
    const webContents = booted.electron.windows[0]!.webContents

    expect(webContents.windowOpenHandler?.({ url: 'https://example.com/broken' })).toEqual({ action: 'deny' })
    await vi.waitFor(() =>
      expect(booted.readLog()).toMatch(/warn kernel 系统浏览器没能打开 https:\/\/example\.com\/broken：.*系统浏览器打不开（测试造的）/),
    )
    expect(booted.readLog()).not.toMatch(/error kernel .*系统浏览器打不开/)
    await quitAndWaitForCleanup(booted)
  })

  it('进程里没被处理的 rejection 与异常记成 kernel 的 error，不退出', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const onRejection = processListenersAddedByMain.find(([key]) => key === 'process:unhandledRejection')?.[1]
    const onException = processListenersAddedByMain.find(([key]) => key === 'process:uncaughtException')?.[1]
    onRejection?.(new Error('插件里没接住的 rejection'))
    onException?.(new Error('插件里没接住的异常'))
    const log = booted.readLog()
    expect(log).toMatch(/error kernel .*插件里没接住的 rejection/)
    expect(log).toMatch(/error kernel .*插件里没接住的异常/)
    expect(booted.electron.exit).not.toHaveBeenCalled()
    await quitAndWaitForCleanup(booted)
  })

  it('没有终端时写 stderr 报的错被吞掉', async () => {
    silenceStderr()
    await importMain({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    expect(processListenersAddedByMain.some(([key]) => key === 'stderr:error')).toBe(true)
  })
})

describe('main.ts：IPC 通道', () => {
  it('gwb:command：命令名不是字符串、没有命令服务时回失败回执', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const relayCommand = booted.electron.ipcHandlers.get('gwb:command')!
    expect(await relayCommand(topFrameEvent, 42, undefined)).toEqual({ ok: false, error: '命令名要是字符串' })
    expect(await relayCommand(topFrameEvent, 'demo.hello', undefined)).toEqual({ ok: false, error: '没有命令服务（ctx.gwbCommands），无法执行 demo.hello' })
    await quitAndWaitForCleanup(booted)
  })

  it('gwb:command 只接收顶层框架：iframe 发来的、发送方框架已销毁的都回失败回执，不交给命令服务', async () => {
    silenceStderr()
    probeGlobal.__gwbMainTestProbe = { events: [] }
    const booted = await bootUntilUp({ gwbHome: fakeHomeWithPlugins() })
    const relayCommand = booted.electron.ipcHandlers.get('gwb:command')!
    const rejected = { ok: false, error: 'gwb:command 只接收顶层框架的调用，demo.echo 没有执行' }
    expect(await relayCommand({ senderFrame: { parent: { parent: null } } }, 'demo.echo', {})).toEqual(rejected)
    expect(await relayCommand({ senderFrame: null }, 'demo.echo', {})).toEqual(rejected)
    expect(await relayCommand(topFrameEvent, 'demo.echo', {})).toMatchObject({ ok: true })
    await quitAndWaitForCleanup(booted)
  })

  it('gwb:hello：向发来的页面回一条整份外壳状态；没有外壳时 url 是 null，report 列出 home 与条目', async () => {
    silenceStderr()
    const booted = await bootUntilUp({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const sender = { send: vi.fn() }
    booted.electron.ipcListeners.get('gwb:hello')!({ sender })
    expect(sender.send).toHaveBeenCalledTimes(1)
    const [channel, message] = sender.send.mock.calls[0] as [string, { url: unknown; report: { home: string; entries: { id: string; name: string; state: string }[]; errors: unknown[] } }]
    expect(channel).toBe('gwb:shell')
    expect(Object.keys(message).sort()).toEqual(['report', 'url'])
    expect(message.url).toBeNull()
    expect(message.report.home).toBe(booted.dataDir)
    expect(message.report.entries).toContainEqual({ id: 'home', name: 'cordis:include', state: 'ACTIVE' })
    await quitAndWaitForCleanup(booted)
  })
})

describe('main.ts：插件看到的内核', () => {
  it('插件拿到 gwbKernel：只有 dataDir、version、emit、setShell 四个成员，dataDir 是 home 的真实路径、version 是内核包的版本；页面的命令交给插件提供的 gwbCommands，带上 via: ui', async () => {
    silenceStderr()
    probeGlobal.__gwbMainTestProbe = { events: [] }
    const booted = await bootUntilUp({ gwbHome: fakeHomeWithPlugins() })
    const probe = probeGlobal.__gwbMainTestProbe
    expect(Object.keys(probe.kernel!).sort()).toEqual(['dataDir', 'emit', 'setShell', 'version'])
    expect(probe.kernel?.dataDir).toBe(booted.dataDir)
    expect(probe.kernel?.version).toBe(kernelPackageVersion)
    const relayCommand = booted.electron.ipcHandlers.get('gwb:command')!
    expect(await relayCommand(topFrameEvent, 'demo.echo', { a: 1 })).toEqual({ ok: true, data: { command: 'demo.echo', args: { a: 1 }, context: { via: 'ui' } } })
    await quitAndWaitForCleanup(booted)
  })

  it('emit 推 gwb:event；setShell 立刻推整份状态，后调用的替换先调用的，撤销只在自己仍是当前外壳时清空', async () => {
    silenceStderr()
    probeGlobal.__gwbMainTestProbe = { events: [] }
    const booted = await bootUntilUp({ gwbHome: fakeHomeWithPlugins() })
    const kernel = probeGlobal.__gwbMainTestProbe.kernel!
    const window = booted.electron.windows[0]!
    kernel.emit({ hello: 'page' })
    expect(window.webContents.send).toHaveBeenCalledWith('gwb:event', { hello: 'page' })

    const revokeFirst = kernel.setShell('file:///first-shell.js')
    expect(shellMessagesSent(window).at(-1)?.url).toBe('file:///first-shell.js')
    const revokeSecond = kernel.setShell('file:///second-shell.js')
    expect(shellMessagesSent(window).at(-1)?.url).toBe('file:///second-shell.js')
    const sentBeforeStaleRevoke = shellMessagesSent(window).length
    revokeFirst()
    expect(shellMessagesSent(window)).toHaveLength(sentBeforeStaleRevoke)
    revokeSecond()
    expect(shellMessagesSent(window).at(-1)?.url).toBeNull()

    const latest = shellMessagesSent(window).at(-1)!
    expect(latest.report.entries).toContainEqual({ id: 'home:probe', name: 'gwb-test-probe', state: 'ACTIVE' })
    await quitAndWaitForCleanup(booted)
  })

  it('插件写一行 error：去抖后推一次 gwb:shell，report.errors 带上这一行', async () => {
    silenceStderr()
    probeGlobal.__gwbMainTestProbe = { events: [] }
    const booted = await bootUntilUp({ gwbHome: fakeHomeWithPlugins() })
    const window = booted.electron.windows[0]!
    await new Promise((resolve) => setTimeout(resolve, 300))
    const sentBefore = shellMessagesSent(window).length
    probeGlobal.__gwbMainTestProbe.logger!.error('探针插件报的错')
    probeGlobal.__gwbMainTestProbe.logger!.error('探针插件报的第二个错')
    await vi.waitFor(() => expect(shellMessagesSent(window).length).toBe(sentBefore + 1), { timeout: 2_000 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(shellMessagesSent(window)).toHaveLength(sentBefore + 1)
    const errors = shellMessagesSent(window).at(-1)!.report.errors
    expect(errors.some((line) => line.includes('error probe 探针插件报的错'))).toBe(true)
    expect(errors.some((line) => line.includes('error probe 探针插件报的第二个错'))).toBe(true)
    expect(booted.readLog()).toContain('error probe 探针插件报的错')
    await quitAndWaitForCleanup(booted)
  })

  it('插件或页面写 warn：只进日志，不推 gwb:shell', async () => {
    silenceStderr()
    probeGlobal.__gwbMainTestProbe = { events: [] }
    const booted = await bootUntilUp({ gwbHome: fakeHomeWithPlugins() })
    const window = booted.electron.windows[0]!
    await new Promise((resolve) => setTimeout(resolve, 300))
    const sentBefore = shellMessagesSent(window).length
    probeGlobal.__gwbMainTestProbe.logger!.warn('探针插件的警告')
    window.webContents.events.emit('console-message', { level: 'warning', message: '页面的警告' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(shellMessagesSent(window)).toHaveLength(sentBefore)
    expect(booted.readLog()).toContain('warn probe 探针插件的警告')
    expect(booted.readLog()).toContain('warn renderer 页面的警告')
    await quitAndWaitForCleanup(booted)
  })
})

describe('main.ts：退出', () => {
  it('will-quit：先拦下退出，卸载整棵插件树（插件的清理执行完），写一行再退出；再次进入 will-quit 直接放行', async () => {
    silenceStderr()
    probeGlobal.__gwbMainTestProbe = { events: [] }
    const booted = await bootUntilUp({ gwbHome: fakeHomeWithPlugins() })
    const firstWillQuit = await quitAndWaitForCleanup(booted)
    expect(firstWillQuit.preventDefault).toHaveBeenCalledTimes(1)
    expect(probeGlobal.__gwbMainTestProbe.events).toContain('probe disposed')
    expect(booted.readLog()).toContain('清理完成，退出')
    const secondWillQuit = { preventDefault: vi.fn() }
    booted.electron.appEvents.emit('will-quit', secondWillQuit)
    expect(secondWillQuit.preventDefault).not.toHaveBeenCalled()
  })

  it('loader 还没加载就退出：直接放行，不拦', async () => {
    silenceStderr()
    const booted = await importMain({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    const willQuitEvent = { preventDefault: vi.fn() }
    booted.electron.appEvents.emit('will-quit', willQuitEvent)
    expect(willQuitEvent.preventDefault).not.toHaveBeenCalled()
  })

  it('所有窗口关闭就退出应用', async () => {
    silenceStderr()
    const booted = await importMain({ gwbHome: makeTemporaryDir('gwb-main-home-') })
    booted.electron.appEvents.emit('window-all-closed')
    expect(booted.electron.quit).toHaveBeenCalled()
  })
})
