/**
 * docfirst 配置：命令行和站读的是同一份。项目根是这个站目录，被引用的代码在仓根，引用写 `../apps/…`、`../installer/…`。
 *
 * content 是各区的上一级目录。它下面只有两个名字是固定的：`trajectory/` 是轨迹卡目录，
 * `future/` 是未来区（路线、在途方案 `future/spec/`、别的仓投来的反馈 `future/inbox/`）。
 * 其余目录都是现状区，全部进 check；本站的现状区是 `content/docs/`。
 *
 * outputs 把正本映射到生成物：仓根 README.md / AGENTS.md / INSTALL.md / CLAUDE.md 由 `content/docs/outputs/` 下的
 * 同名 mdx 生成。改正本后运行 `pnpm doc:render`，正本与生成物放进同一个提交。生成正本按原文渲染，里面不能用 JSX 组件。
 *
 * components 是组件名册，fumadocsRoster 给 fumadocs 自带文件树 Files / Folder / File 与 Note 的压平规则，
 * 站里自己加的组件在它后面追加。
 */
import { fumadocsRoster } from '@godcreator/docfirst-workflow/fumadocs/roster'

export default {
  content: 'content',
  outputs: {
    'content/docs/outputs/readme.mdx': ['../README.md'],
    'content/docs/outputs/agents.mdx': ['../AGENTS.md'],
    'content/docs/outputs/install.mdx': ['../INSTALL.md'],
    'content/docs/outputs/claude.mdx': ['../CLAUDE.md'],
  },
  components: {
    ...fumadocsRoster,
    // 示意图：机读版只保留「[图] 标题」和子元素里的文字说明
    Diagram: (node, h) => [h.paragraph(`[图] ${h.attr(node, 'title') ?? h.attr(node, 'name') ?? ''}`), ...h.children()],
    // fumadocs 的提示框：机读版里标题变成「[注意] 标题」一段，正文照原样保留
    Callout: (node, h) => [h.paragraph(`[注意] ${h.attr(node, 'title') ?? ''}`), ...h.children()],
  },
}
