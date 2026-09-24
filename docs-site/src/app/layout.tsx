import { RootProvider } from 'fumadocs-ui/provider/next'
import './global.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/** 浏览器标签页上的标题：各页是「页面标题 | 站名」，没有页面标题时只有站名 */
export const metadata: Metadata = {
  title: { default: 'gwb 内核', template: '%s | gwb 内核' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
