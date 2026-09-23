/**
 * 示意图：`<Diagram name="…" title="…">文字说明</Diagram>`。
 *
 * 人看到的是 `name` 对应的那张 SVG（静态图或分步动画），agent 读 mdx 源文件看到的是 title 与子元素里的
 * 文字说明（docfirst.config.mjs 里的规则只保留这两样）。所以**说明文字要能单独读懂**：图画的是什么、
 * 谁连着谁，文字里都要有，图只是把它画出来。图不在 docfirst 的检查范围里，只画设计与接缝这一层。
 * 这套组件是从块笔记文档站复制来的，两个站都用下来之后再合并进 docfirst。
 */
import type { ReactNode } from 'react'
import { CommandRelay } from './diagrams/command-relay'
import { KernelBoot } from './diagrams/kernel-boot'
import { PluginHome } from './diagrams/plugin-home'
import { PluginSeam } from './diagrams/plugin-seam'
import { PmBusy } from './diagrams/pm-busy'
import { PmCommands } from './diagrams/pm-commands'
import { PmHomeContents } from './diagrams/pm-home-contents'
import { PmInstall } from './diagrams/pm-install'
import { PmList } from './diagrams/pm-list'
import { PmModules } from './diagrams/pm-modules'
import { PmPickId } from './diagrams/pm-pick-id'
import { PmPnpmLookup } from './diagrams/pm-pnpm-lookup'
import { PmRemount } from './diagrams/pm-remount'
import { PmUninstall } from './diagrams/pm-uninstall'
import { PmUpgrade } from './diagrams/pm-upgrade'
import { PmUpgradeGap } from './diagrams/pm-upgrade-gap'
import { SeamMap } from './diagrams/seam-map'
import { SharedNames } from './diagrams/shared-names'
import { ShellHandover } from './diagrams/shell-handover'

const drawings: Record<string, () => ReactNode> = {
  'seam-map': () => <SeamMap />,
  'kernel-boot': () => <KernelBoot />,
  'plugin-seam': () => <PluginSeam />,
  'plugin-home': () => <PluginHome />,
  'pm-modules': () => <PmModules />,
  'pm-list': () => <PmList />,
  'pm-busy': () => <PmBusy />,
  'pm-commands': () => <PmCommands />,
  'pm-install': () => <PmInstall />,
  'pm-home-contents': () => <PmHomeContents />,
  'pm-uninstall': () => <PmUninstall />,
  'pm-remount': () => <PmRemount />,
  'pm-upgrade': () => <PmUpgrade />,
  'pm-upgrade-gap': () => <PmUpgradeGap />,
  'pm-pick-id': () => <PmPickId />,
  'pm-pnpm-lookup': () => <PmPnpmLookup />,
  'shell-handover': () => <ShellHandover />,
  'shared-names': () => <SharedNames />,
  'command-relay': () => <CommandRelay />,
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
