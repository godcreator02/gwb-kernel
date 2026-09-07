import { clientUrl } from '../../shared/asset-url'

/**
 * 渲染层本体：找到外壳件、把 #root 交给它，再没别的。
 * 没有外壳就留白，原因进 console。取舍见文档站。
 */

interface EntryView {
  id: string
  ok: boolean
  why?: string
  pkg?: string
  shell?: boolean
}

interface ShellModule {
  mountShell?: (args: { host: { call: (command: string, args?: unknown) => Promise<unknown> } }, root: HTMLElement) => void
}

declare global {
  interface Window {
    gwb: {
      command<T = unknown>(command: string, args?: unknown): Promise<T>
      onEvent(cb: (payload: unknown) => void): () => void
    }
  }
}

async function boot(): Promise<void> {
  const info = await window.gwb.command<{ ok?: boolean; data?: { entries?: EntryView[] } }>('kernel.info')
  const entries = info.data?.entries ?? []
  const shells = entries.filter((e) => e.ok && e.shell === true && e.pkg !== undefined)
  if (shells.length === 0) {
    console.error('[renderer] 没有外壳件挂上,界面到此为止。装一个 gwb.shell 为 true 的件,或看宿主日志')
    return
  }
  // 一扇窗只交得出一个界面根，多条时不挑
  if (shells.length > 1) {
    console.error(`[renderer] 多条外壳同时挂上,不挑:${shells.map((s) => s.id).join('、')}`)
    return
  }
  const pkg = shells[0]!.pkg!
  const mod = (await import(/* @vite-ignore */ clientUrl(pkg))) as ShellModule
  if (typeof mod.mountShell !== 'function') {
    console.error(`[renderer] ${pkg} 的 client 没有 mountShell 导出`)
    return
  }
  mod.mountShell(
    { host: { call: (command, args) => window.gwb.command(command, args) } },
    document.getElementById('root')!,
  )
  console.log(`SHELL ${pkg}`)
}

void boot().catch((err: unknown) => console.error(`[renderer] 起不来:${String(err)}`))
