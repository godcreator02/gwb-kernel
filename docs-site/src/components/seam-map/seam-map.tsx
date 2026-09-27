'use client';
/**
 * 接缝图。不带属性画全局图：内核应用、安装包与 cordis、插件、home 里的文件、页面之间的接缝（首页用）。
 * 带 module 属性画那个包内部的接缝图：包里的文件、文件之间的接缝、包外谁调用它、它要谁实现（包首页用）。
 * 每张图的内容在 *.data.mjs，坐标与图标在 *.layout.ts；机读版由 seam-map.ai.mjs 读同一份内容生成。
 */
import { SeamDiagram } from '@godcreator/explainer-player';
import type { SeamLayout } from '@godcreator/explainer-player';
import type { SeamGraph } from '@godcreator/explainer-player/seam-graph';
import { systemGraph } from './system.data.mjs';
import { systemLayout } from './system.layout';
import { desktopGraph } from './inner/desktop.data.mjs';
import { desktopLayout } from './inner/desktop.layout';
import { installerGraph } from './inner/installer.data.mjs';
import { installerLayout } from './inner/installer.layout';

const INNER: Record<string, { graph: SeamGraph; layout: SeamLayout }> = {
  desktop: { graph: desktopGraph, layout: desktopLayout },
  installer: { graph: installerGraph, layout: installerLayout },
};

export function SeamMap({ module: moduleId }: { module?: string }) {
  if (moduleId === undefined) return <SeamDiagram graph={systemGraph} layout={systemLayout} />;
  const inner = INNER[moduleId];
  if (inner === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return <SeamDiagram graph={inner.graph} layout={inner.layout} />;
}
