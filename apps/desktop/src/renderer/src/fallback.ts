/**
 * 阶段页：外壳件还没上来时摆在 #root 上的已装清单。
 *
 * 它只摆「还没到」的事实——哪几条、挂上没有、停没停用——不解释失败为什么失败，
 * 成因的话归 console（主进程把它们转到终端）。数据是 main.ts 轮询 `kernel.info`
 * 喂进来的，这里只管画与拆；外壳接手成功整页拆掉，拆了不回头。
 */

/** 一条条目在页面上的样子——与宿主 `kernel.info` 的 EntryView 同形 */
export interface StageEntry {
  id: string
  ok: boolean
  pkg: string
  disabled: boolean
}

export interface StagePage {
  /** 重画清单。null = 这一问没问着内核：状态行换口气，清单留上一次的 */
  update(entries: StageEntry[] | null): void
  /** 整页拆掉。外壳接手成功才调 */
  dispose(): void
}

const STYLE = `
/* body 默认 8px 边距会把 100vh 的页顶出 16px 溢出——滚动条就是这么来的。随本页拆掉 */
html,body{margin:0}
.gwb-stage{min-height:100vh;box-sizing:border-box;padding:32px 36px;background:#151518;
  font:13px/1.6 system-ui,'Segoe UI',sans-serif;color:#c9c9c2}
.gwb-stage-title{margin:0;font-size:15px;font-weight:600;letter-spacing:.02em;color:#e8e8e2}
.gwb-stage-status{margin:4px 0 24px;color:#8b8b84}
.gwb-stage-list{display:flex;flex-direction:column;gap:2px}
.gwb-stage-row{display:flex;align-items:baseline;gap:10px;padding:6px 10px;border-radius:6px;background:#1d1d21}
.gwb-stage-pkg{color:#dcdcd5}
.gwb-stage-id{color:#6f6f68;font-size:12px}
.gwb-stage-st{margin-left:auto;flex:none;font-size:12px}
.gwb-stage-st-ok{color:#8fc98f}
.gwb-stage-st-bad{color:#d98f8f}
.gwb-stage-st-off{color:#77776f}
.gwb-stage-empty{margin:0;color:#8b8b84}
.gwb-stage-hint{margin:28px 0 0;font-size:12px;color:#5f5f59}
`

const WAITING = '等待外壳件（provide gwbShell 的那个）上来，上来就顶掉这页…'
const LOST = '与内核失联，重试中…'

export function mountFallback(root: HTMLElement, entries: StageEntry[]): StagePage {
  const page = document.createElement('section')
  page.className = 'gwb-stage'
  page.innerHTML = `<style>${STYLE}</style>
<h1 class="gwb-stage-title">gwb 内核</h1>
<p class="gwb-stage-status"></p>
<div class="gwb-stage-list"></div>
<p class="gwb-stage-hint">装件的路子在 home 里那份 README：进 home · pnpm add · cordis.yml 写条目</p>`
  const status = page.querySelector('.gwb-stage-status') as HTMLElement
  const list = page.querySelector('.gwb-stage-list') as HTMLElement
  root.appendChild(page)

  const render = (items: StageEntry[]): void => {
    list.textContent = ''
    if (items.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'gwb-stage-empty'
      empty.textContent = 'home 里还没有装任何件'
      list.appendChild(empty)
      return
    }
    for (const item of items) {
      const row = document.createElement('div')
      row.className = 'gwb-stage-row'
      const name = document.createElement('span')
      name.className = 'gwb-stage-pkg'
      // 包名缺席（条目表里没写 name）就拿 id 顶上，别画一行空的
      name.textContent = item.pkg === '' ? item.id : item.pkg
      row.appendChild(name)
      if (item.id !== '' && item.id !== item.pkg) {
        const id = document.createElement('span')
        id.className = 'gwb-stage-id'
        id.textContent = item.id
        row.appendChild(id)
      }
      const st = document.createElement('span')
      st.className = `gwb-stage-st gwb-stage-st-${item.disabled ? 'off' : item.ok ? 'ok' : 'bad'}`
      st.textContent = item.disabled ? '已停用' : item.ok ? '挂上了' : '没挂上'
      row.appendChild(st)
      list.appendChild(row)
    }
  }

  const update = (items: StageEntry[] | null): void => {
    status.textContent = items === null ? LOST : WAITING
    if (items !== null) render(items)
  }

  update(entries)
  return { update, dispose: () => page.remove() }
}
