import { assetUrl, clientUrl } from '../../shared/asset-url'

/**
 * 渲染层本体：把运行时环境注进页面、找到外壳件、把 #root 交给它，再没别的。
 * 没有外壳就留白，原因进 console。取舍见文档站。
 */

interface EntryView {
  id: string
  ok: boolean
  pkg: string
  disabled: boolean
}

/** 内核收齐的运行时环境：裸名 → 哪个包的哪个子路径 */
type SharedView = Record<string, { pkg: string; sub: string }>

interface KernelInfo {
  ok?: boolean
  data?: {
    dataDir?: string
    entries?: EntryView[]
    /** 界面根交给哪个包。内核看「谁 provide 了 gwbShell」，没有就是 null */
    shellPkg?: string | null
    shared?: SharedView
    sharedConflicts?: string[]
  }
}

/**
 * 外壳件的浏览器那半。导出名叫 `bootShell` 而不是 `mount`——它占的是**整页那个根**，
 * 跟「井里的一格」是两种东西：外壳拿条目表去排窗格，窗格拿 shell 与 pane。
 * 两个角色各用各的动词，单看导出名就知道自己是哪种件。
 */
interface ShellModule {
  bootShell?: (
    args: {
      host: { call: (command: string, args?: unknown) => Promise<unknown> }
      home: string
      entries: EntryView[]
    },
    root: HTMLElement,
  ) => { dispose(): void }
}

declare global {
  interface Window {
    gwb: {
      command<T = unknown>(command: string, args?: unknown): Promise<T>
      onEvent(cb: (payload: unknown) => void): () => void
    }
  }
}

/**
 * 把运行时环境注进页面：裸名 → gwb:// 地址。
 * 必须赶在第一句动态 import 之前——注入之后解析的模块才吃得到这张表，
 * 而**已经解析过的裸名后来再注也覆盖不掉**（浏览器如此，实测过）。
 */
function injectImportmap(shared: SharedView): string[] {
  const imports: Record<string, string> = {}
  for (const [bare, target] of Object.entries(shared)) imports[bare] = assetUrl(target.pkg, target.sub)
  const names = Object.keys(imports)
  if (names.length === 0) return names
  const el = document.createElement('script')
  el.type = 'importmap'
  el.textContent = JSON.stringify({ imports })
  document.head.appendChild(el)
  return names
}

async function boot(): Promise<void> {
  const info = await window.gwb.command<KernelInfo>('kernel.info')
  const data = info.data ?? {}
  const entries = data.entries ?? []
  // 撞名不静默：页面上跑的是哪一份，得说得出来
  for (const line of data.sharedConflicts ?? []) console.error(`[renderer] 运行时环境撞名——${line}`)
  const names = injectImportmap(data.shared ?? {})
  console.log(`SHARED ${names.length === 0 ? '（空）' : names.join('、')}`)

  // 挑外壳的活全在内核那边：它看「谁 provide 了 gwbShell 服务」，而且只认真的挂起来了的。
  // **「多条外壳」这种局面不用在这儿处理**——cordis 的 provide 撞名直接抛，第二个件根本
  // 挂不上，宿主日志里会明说撞的是谁
  const pkg = data.shellPkg
  if (typeof pkg !== 'string' || pkg === '') {
    // 话要能分开三种成因，别像以前那样一句「没有外壳件挂上」把「装了但在等依赖」也盖进去
    const waiting = entries.filter((e) => !e.ok && !e.disabled)
    const why =
      waiting.length === 0
        ? '一个件都没 provide 它——home 里装外壳件了吗'
        : `这几条还没挂上,外壳可能在等它们:${waiting.map((e) => e.id).join('、')}`
    console.error(`[renderer] 没有件提供 gwbShell 服务,界面到此为止。${why}。细节看宿主日志`)
    return
  }
  const mod = (await import(/* @vite-ignore */ clientUrl(pkg))) as ShellModule
  if (typeof mod.bootShell !== 'function') {
    console.error(`[renderer] ${pkg} 的 client 没有 bootShell 导出`)
    return
  }
  const handle = mod.bootShell(
    {
      host: { call: (command, args) => window.gwb.command(command, args) },
      home: data.dataDir ?? '',
      entries,
    },
    document.getElementById('root')!,
  )
  // 句柄先接住，**眼下没有人调 dispose**：渲染层不感知条目变化，热换外壳那条路还不存在。
  // 口留在这儿，将来真要拆这棵树时不必回头改契约
  void handle
  console.log(`SHELL ${pkg}`)
}

void boot().catch((err: unknown) => console.error(`[renderer] 起不来:${String(err)}`))
