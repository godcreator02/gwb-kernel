/**
 * 这个文档站的 docfirst 配置：用哪个格式包、哪几个目录参与检查、轨迹卡目录在哪、生成物写到哪、组件名单。
 * 命令行和文档站读的是同一份。
 *
 * 项目根是站目录，被引用的源码在仓根（../apps…），引用里的路径都相对站目录。
 * 六个区里只有 docs（现状）与 outputs（生成物的正本）参与检查——只有这两个区的内容对应当前代码；
 * 轨迹、交接、未来、反馈四个区不参与检查，轨迹卡里不许引用代码。
 *
 * outputs：仓根 README.md、AGENTS.md、INSTALL.md、CLAUDE.md 都是生成物，正本是 content/outputs/ 下
 * 同名的 mdx。改 mdx 正本后在站目录运行 `pnpm docfirst render` 重新生成，正本与生成物放进同一个提交。
 */
import * as fumadocs from '@godcreator/docfirst-workflow/fumadocs'

export default {
  formats: [fumadocs],
  docs: ['content/docs', 'content/outputs'],
  out: 'out',
  comparator: 'git',
  trajectory: 'content/trajectory',
  outputs: {
    'content/outputs/readme.mdx': ['../README.md'],
    'content/outputs/agents.mdx': ['../AGENTS.md'],
    'content/outputs/install.mdx': ['../INSTALL.md'],
    'content/outputs/claude.mdx': ['../CLAUDE.md'],
  },
  components: {
    ...fumadocs.defaultRoster,
    // 示意图：图本身 agent 看不见，生成文件时只保留「[图] 标题」和子元素里的文字说明
    Diagram: (node, h) => [h.paragraph(`[图] ${h.attr(node, 'title') ?? h.attr(node, 'name') ?? ''}`), ...h.children()],
    // fumadocs 的提示框：生成文件时标题变成「[注意] 标题」一段，正文照原样保留（行内代码不转义）
    Callout: (node, h) => [h.paragraph(`[注意] ${h.attr(node, 'title') ?? ''}`), ...h.children()],
  },
}
