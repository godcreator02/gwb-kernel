/**
 * 第一刀的渲染层:一张写死的页,只为证明桥是通的。
 * 第三刀接上 gwb:// 与外壳之后,这里会退成「找外壳、把 #root 交出去」。
 */

declare global {
  interface Window {
    gwb: {
      command(command: string, args?: unknown): Promise<unknown>
      onEvent(cb: (payload: unknown) => void): () => void
    }
  }
}

const root = document.getElementById('root')!
root.style.cssText = 'font:14px ui-monospace,Consolas,monospace;padding:24px;line-height:1.7;'

const title = document.createElement('h1')
title.textContent = 'gwb-kernel · 第一刀'
title.style.cssText = 'font-size:16px;margin:0 0 4px;'

const note = document.createElement('p')
note.textContent = '按钮打通:渲染层 → IPC → 主进程 → fd3 → 宿主子进程(cordis) → 原路回来'
note.style.cssText = 'margin:0 0 16px;color:#666;'

const button = document.createElement('button')
button.textContent = '调 kernel.info'
button.style.cssText = 'padding:6px 16px;cursor:pointer;'

const box = document.createElement('pre')
box.style.cssText = 'margin-top:16px;padding:12px;background:#f4f4f5;border-radius:8px;white-space:pre-wrap;'

button.onclick = () => {
  button.disabled = true
  void window.gwb.command('kernel.info').then(
    (res) => {
      box.textContent = JSON.stringify(res, null, 2)
      button.disabled = false
    },
    (err: unknown) => {
      box.textContent = `失败:${String(err)}`
      button.disabled = false
    },
  )
}

root.append(title, note, button, box)

// 自检:开页走两条——内核自省口一条，插件注册的命令一条（后者证明挂上的件真活着）。
// 第三刀接上外壳之后这段删掉——那时「通没通」由界面本身证明
void Promise.all([window.gwb.command('kernel.info'), window.gwb.command('probe.hello', { n: 1 })]).then(
  ([info, viaPlugin]) => {
    box.textContent = JSON.stringify({ info, viaPlugin }, null, 2)
    console.log(`SELFCHECK ${JSON.stringify({ info, viaPlugin })}`)
  },
  (err: unknown) => console.log(`SELFCHECK FAILED ${String(err)}`),
)

export {}
