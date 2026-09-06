/**
 * 这个站怎么挂 livedoc：格式包、文档目录、产物摆放、组件名册。命令行和站读的是同一份。
 *
 * 项目根是站目录，将来要钉的源码在仓根（../apps…）——引用里的路径相对项目根。
 * **眼下一条引用都没写**：文档还没到「对代码说具体的话」那一步，钉了只会把没定型的
 * 结构冻起来。等某一页开始讲某个文件里的某几行，那一页再写 @@livedoc ref 记号。
 *
 * outputs：仓根 README.md 是生成物，正本是 content/docs/readme.mdx。
 * 改 mdx 源，`pnpm livedoc render --target ai` 重摆，一起提交。
 */
import * as fumadocs from '@godcreator02/live-doc-format-fumadocs'

export default {
  formats: [fumadocs],
  docs: 'content/docs',
  out: 'out',
  outputs: {
    'content/docs/readme.mdx': ['../README.md'],
  },
  components: {
    ...fumadocs.defaultRoster,
  },
}
