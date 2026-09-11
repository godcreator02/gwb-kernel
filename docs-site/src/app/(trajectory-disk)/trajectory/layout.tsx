import type { ReactNode } from 'react'

// 盘页这一组只套最简壳：整个视口就是盘，不要 DocsLayout 的侧栏与目录。
// RootProvider（主题、搜索上下文）在根 layout 里，这儿不必再来一层。
export default function Layout({ children }: { children: ReactNode }) {
  return children
}
