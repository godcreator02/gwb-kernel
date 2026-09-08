/**
 * 崩溃页：宿主退出后整页换上的收尸页。
 *
 * 它和阶段页踩同一条线，只是换了个时态：阶段页陈述「还没到」，这页陈述「已经没了」——
 * 退出码、临终日志尾巴的原文、日志文件在哪，三样都是事实，一句成因的话都不搬上页面，
 * 也不摆重试。数据来自 `window.gwb` 现成的两条：`onHostExit` 的讣告与 `logs.backlog()`。
 *
 * **挂在 `document.body` 上，不进 `#root`**：外壳的 `dispose` 会清空 `#root`（同步抹一遍、
 * 异步再 unmount 一遍），挤进那个容器里的东西随时会被它带走。整屏固定定位盖上去，
 * 谁清谁的锅互不干涉。
 */

import { formatLogLine, type LogEntry } from '../../shared/protocol'

export interface CrashInfo {
  /** 宿主的退出码。被信号打死时是 null（Windows 上一般见不着） */
  code: number | null
  /** 临终日志尾巴，原文照抄，新的在最后 */
  tail: LogEntry[]
  /** 日志目录——boot 时从 `kernel.info` 拿的，崩了之后问不着内核 */
  logDir: string
}

const STYLE = `
.gwb-crash{position:fixed;inset:0;z-index:2147483647;overflow:auto;box-sizing:border-box;
  padding:32px 36px;background:#151518;
  font:13px/1.6 system-ui,'Segoe UI',sans-serif;color:#c9c9c2}
.gwb-crash-title{margin:0;font-size:15px;font-weight:600;letter-spacing:.02em;color:#d98f8f}
.gwb-crash-sub{margin:4px 0 20px;color:#8b8b84}
.gwb-crash-log{margin:0;padding:14px 16px;border-radius:6px;background:#1d1d21;
  font:12px/1.7 Consolas,monospace;color:#a8a8a0;white-space:pre-wrap;word-break:break-all;
  max-height:60vh;overflow:auto}
.gwb-crash-hint{margin:20px 0 0;font-size:12px;color:#5f5f59}
`

export function mountCrash(info: CrashInfo): { dispose(): void } {
  const page = document.createElement('section')
  page.className = 'gwb-crash'
  page.innerHTML = `<style>${STYLE}</style>
<h1 class="gwb-crash-title"></h1>
<p class="gwb-crash-sub"></p>
<pre class="gwb-crash-log"></pre>
<p class="gwb-crash-hint"></p>`
  const title = page.querySelector('.gwb-crash-title') as HTMLElement
  const sub = page.querySelector('.gwb-crash-sub') as HTMLElement
  const log = page.querySelector('.gwb-crash-log') as HTMLElement
  const hint = page.querySelector('.gwb-crash-hint') as HTMLElement

  title.textContent = `宿主退出（code=${info.code ?? '?'}）`
  sub.textContent = `${new Date().toLocaleTimeString()} · 临终日志的尾巴，原文照抄，新的在最后`
  // 日志行是四路来的不可信文本，一律 textContent，不过 innerHTML
  log.textContent =
    info.tail.length === 0
      ? '（一条都没赶上——backlog 里是空的）'
      : info.tail.map((line) => formatLogLine(line)).join('\n')
  hint.textContent =
    info.logDir === '' ? '完整日志的位置这趟没拿到，主进程终端里有' : `完整日志：${info.logDir} 里的 gwb.log`

  document.body.appendChild(page)
  return { dispose: () => page.remove() }
}
