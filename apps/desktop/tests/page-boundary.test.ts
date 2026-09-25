import { describe, expect, it } from 'vitest'
import { isReloadOfCurrentDocument, isTopFrame } from '../src/page-boundary'

const indexHtml = 'file:///C:/Users/me/AppData/Roaming/gwb-kernel/homes/x/node_modules/@godcreator/gwb-kernel-desktop/dist/index.html'

describe('isReloadOfCurrentDocument：主框架只能重新加载它正显示的那一页', () => {
  it('跳到同一个地址（整页重新加载）放行，# 片段不算差别', () => {
    expect(isReloadOfCurrentDocument(indexHtml, indexHtml)).toBe(true)
    expect(isReloadOfCurrentDocument(`${indexHtml}#/panes/logs`, indexHtml)).toBe(true)
    expect(isReloadOfCurrentDocument(indexHtml, `${indexHtml}#/panes/logs`)).toBe(true)
  })

  it('网页、别的本地文件、同一文件带查询串、拖进来的文件都拒绝', () => {
    expect(isReloadOfCurrentDocument('https://example.com/', indexHtml)).toBe(false)
    expect(isReloadOfCurrentDocument('file:///C:/Users/me/Desktop/notes.html', indexHtml)).toBe(false)
    expect(isReloadOfCurrentDocument(`${indexHtml}?x=1`, indexHtml)).toBe(false)
    expect(isReloadOfCurrentDocument('file:///C:/Users/me/Desktop/photo.png', indexHtml)).toBe(false)
    expect(isReloadOfCurrentDocument('javascript:alert(1)', indexHtml)).toBe(false)
  })

  it('目标不是合法 URL 时拒绝', () => {
    expect(isReloadOfCurrentDocument('not a url', indexHtml)).toBe(false)
  })
})

describe('isTopFrame：gwb:command 只接收顶层框架', () => {
  it('没有父框架的是顶层框架', () => {
    expect(isTopFrame({ parent: null })).toBe(true)
  })

  it('iframe（有父框架）不是', () => {
    expect(isTopFrame({ parent: { parent: null } })).toBe(false)
  })

  it('发送方框架已经跳走或销毁（senderFrame 是 null）也不算', () => {
    expect(isTopFrame(null)).toBe(false)
  })
})
