import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * index.html 里那段页面脚本的行为锁：脚本原文交给一个极简的假 DOM 求值，脚本里的 `import(url)` 换成从下面的
 * 模块表里取（vm 求值的脚本里，动态 import 在测试进程里没有加载器）。页面上真正画出来的样子只能实机验证
 */

class FakeElement {
  readonly tagName: string
  children: FakeElement[] = []
  className = ''
  type = ''
  private ownText = ''

  constructor(tagName: string) {
    this.tagName = tagName
  }

  get textContent(): string {
    return this.children.length > 0 ? this.children.map((child) => child.textContent).join('') : this.ownText
  }

  set textContent(text: string) {
    this.children = []
    this.ownText = text
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child)
    return child
  }
}

interface ShellReport {
  home: string
  entries: { id: string; name: string; state: string }[]
  errors: string[]
}
interface ShellState {
  url: string | null
  imports: Record<string, string>
  report?: ShellReport
}
type OnShellCallback = (shell: ShellState) => Promise<void>

const shellEvents = globalThis as typeof globalThis & { __gwbPageTestEvents?: string[] }

const modulesByUrl = new Map<string, () => Promise<unknown>>()

function registerModule(url: string, load: () => Promise<unknown>): string {
  modulesByUrl.set(url, load)
  return url
}

function shellModuleUrl(label: string, options: { disposeThrows?: boolean } = {}): string {
  const events = (): string[] => shellEvents.__gwbPageTestEvents!
  const shellBoot = (root: FakeElement): { dispose(): void } => {
    events().push(`mount ${label}`)
    root.textContent = `shell ${label}`
    return {
      dispose() {
        if (options.disposeThrows === true) throw new Error(`dispose ${label} 失败`)
        events().push(`dispose ${label}`)
      },
    }
  }
  return registerModule(`test-shell:${label}`, async () => ({ default: shellBoot }))
}

async function importFromModuleTable(url: string): Promise<unknown> {
  const load = modulesByUrl.get(url)
  if (load === undefined) throw new Error(`模块表里没有 ${url}`)
  return load()
}

function loadPageScript(): { root: FakeElement; head: FakeElement; deliver: (shell: ShellState) => Promise<void>; consoleError: ReturnType<typeof vi.fn> } {
  const html = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'index.html'), 'utf8')
  const script = /<script type="module">([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (script === undefined) throw new Error('index.html 里没有找到页面脚本')
  const root = new FakeElement('div')
  const head = new FakeElement('head')
  const document = {
    head,
    getElementById: (id: string) => (id === 'root' ? root : null),
    createElement: (tagName: string) => new FakeElement(tagName),
  }
  let onShell: OnShellCallback | undefined
  const window = {
    gwb: {
      onShell: (callback: OnShellCallback) => {
        onShell = callback
      },
    },
  }
  const consoleError = vi.fn()
  const scriptWithImportSeam = script.replace(/\bimport\(/g, 'importFromModuleTable(')
  const evaluatePageScript = new vm.Script(`(function (document, window, console, importFromModuleTable) {
${scriptWithImportSeam}
})`, { filename: 'index.html' }).runInThisContext() as (...pageGlobals: unknown[]) => void
  evaluatePageScript(document, window, { error: consoleError }, importFromModuleTable)
  if (onShell === undefined) throw new Error('页面脚本没有订阅 onShell')
  const subscribed = onShell
  return { root, head, deliver: (shell) => subscribed(shell), consoleError }
}

const sampleReport: ShellReport = {
  home: 'C:\\homes\\sample',
  entries: [
    { id: 'home', name: 'cordis:include', state: 'ACTIVE' },
    { id: 'home:probe', name: 'gwb-probe', state: 'PENDING（缺 gwbCommands）' },
  ],
  errors: ['2026-09-24T00:00:00.000Z error probe 第一行', '2026-09-24T00:00:01.000Z warn probe 第二行'],
}

function reportBox(root: FakeElement): FakeElement {
  expect(root.children).toHaveLength(1)
  const box = root.children[0]!
  expect(box.className).toBe('gwb-report')
  return box
}

afterEach(() => {
  delete shellEvents.__gwbPageTestEvents
  modulesByUrl.clear()
})

describe('index.html：importmap', () => {
  it('第一条带 imports 的推送注入一次 importmap，之后的推送不再注入', async () => {
    const page = loadPageScript()
    await page.deliver({ url: null, imports: { react: 'file:///r1.js' }, report: sampleReport })
    await page.deliver({ url: null, imports: { react: 'file:///r2.js' }, report: sampleReport })
    expect(page.head.children).toHaveLength(1)
    const importmap = page.head.children[0]!
    expect(importmap.tagName).toBe('script')
    expect(importmap.type).toBe('importmap')
    expect(JSON.parse(importmap.textContent)).toEqual({ imports: { react: 'file:///r1.js' } })
  })

  it('imports 是空表时不注入，留到第一次非空时再注入', async () => {
    const page = loadPageScript()
    await page.deliver({ url: null, imports: {}, report: sampleReport })
    expect(page.head.children).toHaveLength(0)
    await page.deliver({ url: 'x', imports: { react: 'file:///r.js' }, report: sampleReport }).catch(() => {})
    expect(page.head.children).toHaveLength(1)
  })
})

function failingShellUrl(): string {
  return registerModule('test-shell:throws', async () => {
    throw new Error('外壳模块求值失败')
  })
}

describe('index.html：只读状态页', () => {
  it('画出来的是一句说明、home、每个条目一行、最近的错误行，全是文本', async () => {
    const page = loadPageScript()
    await page.deliver({ url: failingShellUrl(), imports: {}, report: sampleReport })
    const box = reportBox(page.root)
    expect(box.children.map((child) => child.tagName)).toEqual(['p', 'p', 'ul', 'p', 'pre'])
    expect(box.children[1]!.textContent).toContain(sampleReport.home)
    expect(box.children[2]!.children.map((item) => item.textContent)).toEqual([
      'home  cordis:include  ACTIVE',
      'home:probe  gwb-probe  PENDING（缺 gwbCommands）',
    ])
    expect(box.children[3]!.textContent).toContain('gwb.log')
    expect(box.children[4]!.textContent).toBe(sampleReport.errors.join('\n'))
  })

  it('一个条目都没有时画一句提示代替列表；没有错误行时不画错误那两段', async () => {
    const page = loadPageScript()
    await page.deliver({ url: failingShellUrl(), imports: {}, report: { home: 'C:\\homes\\empty', entries: [], errors: [] } })
    const box = reportBox(page.root)
    expect(box.children.map((child) => child.tagName)).toEqual(['p', 'p', 'p'])
    expect(box.children[2]!.textContent).toContain('cordis.yml')
  })

  it('推送里没有 report 时只画那一句说明', async () => {
    const page = loadPageScript()
    await page.deliver({ url: failingShellUrl(), imports: {} })
    expect(reportBox(page.root).children.map((child) => child.tagName)).toEqual(['p'])
  })

  it('现状（bug）：没有外壳在加载时推来 url: null，被当成「同一个地址正在加载」直接忽略，只读状态页画不出来', async () => {
    const page = loadPageScript()
    await page.deliver({ url: null, imports: {}, report: sampleReport })
    expect(page.root.children).toHaveLength(0)
  })
})
describe('index.html：外壳接管', () => {
  it('有外壳地址就 import 它，把 #root 交给默认导出；同一个地址再推一次不重复挂载', async () => {
    shellEvents.__gwbPageTestEvents = []
    const page = loadPageScript()
    const url = shellModuleUrl('A')
    await page.deliver({ url, imports: {}, report: sampleReport })
    await page.deliver({ url, imports: {}, report: sampleReport })
    expect(shellEvents.__gwbPageTestEvents).toEqual(['mount A'])
    expect(page.root.textContent).toBe('shell A')
  })

  it('同一个地址在 import 完成前连推两次，只挂载一次', async () => {
    shellEvents.__gwbPageTestEvents = []
    const page = loadPageScript()
    const url = shellModuleUrl('B')
    await Promise.all([page.deliver({ url, imports: {} }), page.deliver({ url, imports: {} })])
    expect(shellEvents.__gwbPageTestEvents).toEqual(['mount B'])
  })

  it('换外壳：先 dispose 旧的、清空 #root，再挂新的', async () => {
    shellEvents.__gwbPageTestEvents = []
    const page = loadPageScript()
    await page.deliver({ url: shellModuleUrl('C'), imports: {} })
    await page.deliver({ url: shellModuleUrl('D'), imports: {} })
    expect(page.root.textContent).toBe('shell D')
    expect(shellEvents.__gwbPageTestEvents).toEqual(['mount C', 'dispose C', 'mount D'])
  })

  it('现状（bug）：外壳在用时推来 url: null 也被忽略，旧外壳不 dispose，页面不回到只读状态页', async () => {
    shellEvents.__gwbPageTestEvents = []
    const page = loadPageScript()
    await page.deliver({ url: shellModuleUrl('G'), imports: {} })
    await page.deliver({ url: null, imports: {}, report: sampleReport })
    expect(shellEvents.__gwbPageTestEvents).toEqual(['mount G'])
    expect(page.root.textContent).toBe('shell G')
  })

  it('旧外壳 dispose 抛错：打一行 console.error，照样换上新的', async () => {
    shellEvents.__gwbPageTestEvents = []
    const page = loadPageScript()
    await page.deliver({ url: shellModuleUrl('E', { disposeThrows: true }), imports: {} })
    await page.deliver({ url: shellModuleUrl('F'), imports: {} })
    expect(page.consoleError).toHaveBeenCalledTimes(1)
    expect(String(page.consoleError.mock.calls[0]?.[0])).toContain('dispose E 失败')
    expect(page.root.textContent).toBe('shell F')
  })

  it('外壳 import 失败：打一行 console.error，回到只读状态页，第一句带着原因', async () => {
    const page = loadPageScript()
    const url = registerModule('test-shell:throws', async () => {
      throw new Error('外壳模块求值失败')
    })
    await page.deliver({ url, imports: {}, report: sampleReport })
    expect(page.consoleError).toHaveBeenCalledTimes(1)
    const box = reportBox(page.root)
    expect(box.children[0]!.textContent).toContain('外壳模块求值失败')
    expect(box.children[2]!.tagName).toBe('ul')
  })

  it('外壳的默认导出不是函数：同样回到只读状态页，第一句带着地址', async () => {
    const page = loadPageScript()
    const url = registerModule('test-shell:not-a-function', async () => ({ default: 42 }))
    await page.deliver({ url, imports: {}, report: sampleReport })
    expect(reportBox(page.root).children[0]!.textContent).toContain(url)
  })

  it('外壳 import 失败后再推同一个地址会重试', async () => {
    shellEvents.__gwbPageTestEvents = []
    const page = loadPageScript()
    const url = registerModule('test-shell:not-a-function', async () => ({ default: 42 }))
    await page.deliver({ url, imports: {} })
    await page.deliver({ url, imports: {} })
    expect(page.consoleError).toHaveBeenCalledTimes(2)
  })
})
