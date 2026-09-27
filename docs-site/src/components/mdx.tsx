/**
 * 名册里给人看的那一半：docfirst.config.mjs 里声明压平表，这里给 React 表。
 * 表的类型由 registry.ts 的名单钉死：少一个编译不过，多一个也编译不过。
 * 跟压平表齐不齐，由 scripts/verify-roster.mjs 两头对。
 * 底下铺 fumadocs 的默认表，再把 pre 换成 @godcreator/docfirst-workflow/fumadocs 里会画状态点的 DocfirstPre。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { DocfirstPre } from '@godcreator/docfirst-workflow/fumadocs/pre';
import type { ComponentName } from './registry';
import { SeamMap } from './seam-map/seam-map';
import { LauncherBootSteps } from './launcher-boot/launcher-boot';
import { LauncherCases } from './launcher-cases/launcher-cases';
import { BootAndRequestSteps } from './boot-and-request/boot-and-request';
import { KernelBootSteps } from './kernel-boot/kernel-boot';
import { BootFailureCases } from './boot-failure/boot-failure';
import { QuitCleanupCases } from './quit-cleanup/quit-cleanup';
import { HomeLoadSteps } from './home-load/home-load';
import { RequestTripSteps } from './request-trip/request-trip';
import { RequestOutcomes } from './request-outcomes/request-outcomes';
import { ShellHandoverSteps } from './shell-handover/shell-handover';
import { ImportCases } from './import-cases/import-cases';
import { LogSources } from './log-sources/log-sources';

export function Note({ children }: { children?: ReactNode }) {
  return <div className="note">{children}</div>;
}

const table: Record<ComponentName, MDXComponents[string]> = {
  Note,
  Files,
  Folder,
  File,
  Callout,
  SeamMap,
  LauncherBootSteps,
  LauncherCases,
  BootAndRequestSteps,
  HomeLoadSteps,
  RequestTripSteps,
  RequestOutcomes,
  ShellHandoverSteps,
  ImportCases,
  LogSources,
  KernelBootSteps,
  BootFailureCases,
  QuitCleanupCases,
};

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...components,
    ...table,
    pre: DocfirstPre,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
