import { describe, expect, it } from 'vitest'
import { isReloadOfCurrentDocument, isTopFrame, opensInSystemBrowser } from '../src/page-boundary'

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

describe('opensInSystemBrowser：window.open 的地址只有 http、https 交给系统浏览器', () => {
  it('http、https 交出去，协议大写也认', () => {
    expect(opensInSystemBrowser('http://example.com/')).toBe(true)
    expect(opensInSystemBrowser('https://example.com/docs?x=1#part')).toBe(true)
    expect(opensInSystemBrowser('HTTPS://EXAMPLE.COM/')).toBe(true)
  })

  it('file、javascript、data、自定义协议不交', () => {
    expect(opensInSystemBrowser('file:///C:/Users/me/Desktop/notes.html')).toBe(false)
    expect(opensInSystemBrowser('javascript:alert(1)')).toBe(false)
    expect(opensInSystemBrowser('data:text/html,<h1>hi</h1>')).toBe(false)
    expect(opensInSystemBrowser('ms-settings:privacy')).toBe(false)
  })

  it('解析不了的字符串不交', () => {
    expect(opensInSystemBrowser('not a url')).toBe(false)
    expect(opensInSystemBrowser('')).toBe(false)
  })
})
