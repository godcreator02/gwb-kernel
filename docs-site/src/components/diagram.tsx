/**
 * 示意图：`<Diagram name="…" title="…">文字说明</Diagram>`。
 *
 * 人看到的是 `name` 对应的那张 SVG（静态图或分步动画），agent 读 mdx 源文件看到的是 title 与子元素里的
 * 文字说明（docfirst.config.mjs 里的规则只保留这两样）。所以**说明文字要能单独读懂**：图画的是什么、
 * 谁连着谁，文字里都要有，图只是把它画出来。图不在 docfirst 的检查范围里，只画设计与接缝这一层。
 * 这套组件是从块笔记文档站复制来的，两个站都用下来之后再合并进 docfirst。
 */
import type { ReactNode } from 'react'
import './diagram.css'
import { CommandRelay } from './diagrams/command-relay'
import { FirstInstall } from './diagrams/first-install'
import { KernelBoot } from './diagrams/kernel-boot'
import { PluginSeam } from './diagrams/plugin-seam'
import { SeamMap } from './diagrams/seam-map'
import { PageReact } from './diagrams/page-react'
import { ShellHandover } from './diagrams/shell-handover'

const drawings: Record<string, () => ReactNode> = {
  'seam-map': () => <SeamMap />,
  'kernel-boot': () => <KernelBoot />,
  'plugin-seam': () => <PluginSeam />,
  'shell-handover': () => <ShellHandover />,
  'page-react': () => <PageReact />,
  'command-relay': () => <CommandRelay />,
  'first-install': () => <FirstInstall />,
}

export function Diagram({ name, title, children }: { name: string; title?: string; children?: ReactNode }) {
  const draw = drawings[name]
  return (
    <figure className="diagram">
      {title !== undefined && <figcaption className="diagram-title">{title}</figcaption>}
      <div className="diagram-canvas">{draw === undefined ? <p>没有叫「{name}」的图（src/components/diagram.tsx 的 drawings 表里没有登记）</p> : draw()}</div>
      {children !== undefined && <div className="diagram-text">{children}</div>}
    </figure>
  )
}
