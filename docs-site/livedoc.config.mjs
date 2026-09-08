/**
 * 这个站怎么挂 livedoc：格式包、文档目录、产物摆放、组件名册。命令行和站读的是同一份。
 *
 * 项目根是站目录，钉的源码在仓根（../apps…）——引用里的路径相对项目根。
 * 钉码集中在 trajectory 的墙卡与 kernel/、plugins/ 的机制页；账本在 .ledger.json。
 *
 * outputs：仓根 README.md 与 AGENTS.md 都是生成物，正本是 content/docs/readme.mdx 与 agents.mdx。
 * 改 mdx 源，`pnpm livedoc render --target ai` 重摆，一起提交。CLAUDE.md 只有一行 @AGENTS.md，不派生。
 */
import * as fumadocs from '@godcreator02/live-doc-format-fumadocs'

export default {
  formats: [fumadocs],
  docs: 'content/docs',
  out: 'out',
  outputs: {
    'content/docs/readme.mdx': ['../README.md'],
    'content/docs/agents.mdx': ['../AGENTS.md'],
  },
  components: {
    ...fumadocs.defaultRoster,
  },
}
