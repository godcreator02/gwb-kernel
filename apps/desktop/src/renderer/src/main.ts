import { assetUrl, clientUrl } from '../../shared/asset-url'
import type { LogEntry } from '../../shared/protocol'
import { mountCrash } from './crash'
import { mountFallback, type StageEntry } from './fallback'

/**
 * 渲染层本体：把运行时环境注进页面、找到外壳件、把 #root 交给它，再没别的。
 * 没有外壳就摆阶段页（已装清单，两秒一问 `kernel.info`，外壳出现就顶掉它）；
 * 没挂上的成因照旧进 console——页面只摆「还没到」的事实，不解释失败。取舍见文档站。
 */

type EntryView = StageEntry

/** 内核收齐的运行时环境：裸名 → 哪个包的哪个子路径 */
type SharedView = Record<string, { pkg: string; sub: string }>

interface KernelInfo {
  ok?: boolean
  data?: {
    dataDir?: string
    /** 日志目录。崩溃页指路用——活着的时候趁 kernel.info 答得动拿住 */
    logDir?: string
    entries?: EntryView[]
    /** 界面根交给哪个包。内核看「谁 provide 了 gwbShell」，没有就是 null */
    shellPkg?: string | null
    shared?: SharedView
    sharedConflicts?: string[]
    /** 声明了 gwb.shared 的包（含空声明）。界面据此分出「共享包」栏目 */
    sharedPkgs?: string[]
  }
}

type KernelData = NonNullable<KernelInfo['data']>

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
      /** 宿主没了的讣告（退出码，信号打死时 null），回注销函数 */
      onHostExit(cb: (code: number | null) => void): () => void
      /**
       * 日志。**页面的公共面，谁在这页上跑都够得着**——件不必经外壳转发。
       * 条目形状是 `{ seq, ts, source, level, name, msg }`，正本在文档站。
       */
      logs: {
        backlog(): Promise<LogEntry[]>
        on(cb: (batch: LogEntry[]) => void): () => void
      }
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

/** 把 #root 交给外壳件：import 它的 client、调 bootShell。没接成才抛，页面上留什么由调用方定 */
async function bootShellInto(pkg: string, data: KernelData, root: HTMLElement): Promise<{ dispose(): void }> {
  const mod = (await import(/* @vite-ignore */ clientUrl(pkg))) as ShellModule
  if (typeof mod.bootShell !== 'function') throw new Error(`${pkg} 的 client 没有 bootShell 导出`)
  const handle = mod.bootShell(
    {
      host: { call: (command, args) => window.gwb.command(command, args) },
      home: data.dataDir ?? '',
      entries: data.entries ?? [],
    },
    root,
  )
  // 句柄交回调用方收着。眼下唯一真调 dispose 的是崩溃页：宿主没了，整页换血前先把
  // 外壳这棵树拆掉——「bootShell 回 { dispose }」这个口立契约时就是为这一天留的
  console.log(`SHELL ${pkg}`)
  return handle
}

/** 阶段页的问询间隔。**单飞**：上一问没回来不排下一问 */
const STAGE_POLL_MS = 2000

/** 阶段页只列用户装的件：内核自己那条 include 根（宿主钉的 `cordis:include` → home）不算 */
function stageEntries(entries: EntryView[]): EntryView[] {
  return entries.filter((e) => e.pkg !== 'cordis:include')
}

/** 崩溃页上日志尾巴的条数。再多就得滚很久——完整的一份在文件里 */
const CRASH_TAIL = 60

async function boot(): Promise<void> {
  const root = document.getElementById('root')!
  let data: KernelData = {}
  let shellHandle: { dispose(): void } | null = null
  let stage: ReturnType<typeof mountFallback> | null = null
  let hostGone = false

  // 订阅要赶在第一句命令之前：宿主要是在 boot 半道咽气，讣告不能漏接。
  // 接到就收尸——拆外壳（还在的话）、拆阶段页，整页换崩溃页，只此一次
  window.gwb.onHostExit((code) => {
    if (hostGone) return
    hostGone = true
    console.error(`宿主退出（code=${code ?? '?'}），整页换崩溃页`)
    void window.gwb.logs
      .backlog()
      .then((all) => {
        try {
          shellHandle?.dispose()
        } catch (err) {
          console.error(`外壳拆不干净:${String(err)}`)
        }
        stage?.dispose()
        mountCrash({ code, tail: all.slice(-CRASH_TAIL), logDir: data.logDir ?? '' })
      })
      .catch((err: unknown) => console.error(`崩溃页摆不上:${String(err)}`))
  })

  const info = await window.gwb.command<KernelInfo>('kernel.info')
  data = info.data ?? {}
  const entries = data.entries ?? []
  // 撞名不静默：页面上跑的是哪一份，得说得出来
  // 前缀不用自己写：主进程收 console-message 时会带上来源，写了就是 `[renderer] [renderer] …`
  for (const line of data.sharedConflicts ?? []) console.error(`运行时环境撞名——${line}`)
  const names = injectImportmap(data.shared ?? {})
  console.log(`SHARED ${names.length === 0 ? '（空）' : names.join('、')}`)

  // 挑外壳的活全在内核那边：它看「谁 provide 了 gwbShell 服务」，而且只认真的挂起来了的。
  // **「多条外壳」这种局面不用在这儿处理**——cordis 的 provide 撞名直接抛，第二个件根本
  // 挂不上，宿主日志里会明说撞的是谁
  const pkg = data.shellPkg
  if (typeof pkg === 'string' && pkg !== '') {
    shellHandle = await bootShellInto(pkg, data, root)
    return
  }

  // 没有外壳。成因分开三种说，照旧归 console——阶段页只摆清单，不替它解释
  const waiting = entries.filter((e) => !e.ok && !e.disabled)
  const why =
    waiting.length === 0
      ? '一个件都没 provide 它——home 里装外壳件了吗'
      : `这几条还没挂上,外壳可能在等它们:${waiting.map((e) => e.id).join('、')}`
  console.error(`没有件提供 gwbShell 服务,界面先给阶段页。${why}。细节看宿主日志`)
  stage = mountFallback(root, stageEntries(entries))

  // 两秒一问，等 shellPkg 变非空。**条目集今天启动即定**（没有热挂载的路），这问
  // 多数时候是空转——它等的是将来的热换外壳，那时不用回头改这里
  for (;;) {
    if (hostGone) return
    await new Promise((resolve) => setTimeout(resolve, STAGE_POLL_MS))
    let next: KernelData | undefined
    try {
      next = (await window.gwb.command<KernelInfo>('kernel.info')).data
    } catch (err) {
      console.error(`阶段页问不动内核:${String(err)}`)
    }
    const shell = next?.shellPkg
    if (next && typeof shell === 'string' && shell !== '') {
      try {
        shellHandle = await bootShellInto(shell, next, root)
      } catch (err) {
        // 接手不成（client 取不到、没有 bootShell、bootShell 自己抛）：阶段页留着，下个周期再试
        console.error(`外壳 ${shell} 接手没成，阶段页留着:${String(err)}`)
        continue
      }
      stage.dispose()
      return
    }
    stage.update(next ? stageEntries(next.entries ?? []) : null)
  }
}

void boot().catch((err: unknown) => console.error(`起不来:${String(err)}`))
