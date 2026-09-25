/** 两边都是 Chromium 规范化过的地址（事件里的目标、webContents.getURL()），直接比字符串 */
function withoutFragment(url: string): string {
  return url.split('#', 1)[0]!
}

/** 主框架只由内核 loadFile 进 index.html；之后页面自己发起的跳转只放行整页重新加载 */
export function isReloadOfCurrentDocument(targetUrl: string, currentUrl: string): boolean {
  return withoutFragment(targetUrl) === withoutFragment(currentUrl)
}

/** senderFrame 在框架跳走或销毁后是 null，那样的调用也不接收 */
export function isTopFrame(frame: { parent: unknown } | null): boolean {
  return frame !== null && frame.parent === null
}
