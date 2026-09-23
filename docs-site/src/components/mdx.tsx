/**
 * MDX 组件表中给人看的那一半：docfirst.config.mjs 声明生成文件时每个组件怎么变成文字，这里给 React 表。
 * 先用 fumadocs 的默认组件，再加上示意图，最后把 pre 换成 docfirst 格式包里会显示引用状态的那个。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { File, Files, Folder } from 'fumadocs-ui/components/files'
import type { MDXComponents } from 'mdx/types'
import { DocfirstPre } from '@godcreator/docfirst-workflow/fumadocs/pre'
import { Diagram } from './diagram'

type Loose = MDXComponents[string]

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    Files: Files as Loose,
    Folder: Folder as Loose,
    File: File as Loose,
    Diagram: Diagram as Loose,
    pre: DocfirstPre as unknown as NonNullable<MDXComponents['pre']>,
  }
}
