/**
 * 这个项目的 docfirst 配置：命令行 docfirst（check / confirm / render / trajectory）读它，项目根是站点目录。
 *
 * content：内容根。下面的 future/ 是未来区、不进核对，其余目录都是现状区、都进 check；本站的现状区是 content/docs/。
 * outputs：仓根（站点目录的上一级）的 README.md / AGENTS.md / INSTALL.md / CLAUDE.md 是生成物，正本是映射左边的 mdx——
 * 改了正本运行 `pnpm doc:render`，两份放进同一个提交，`pnpm doc` 检查生成物跟正本是否一致。
 * CLAUDE.md 第一行固定是 `@AGENTS.md`，只给 Claude 的指令写在它后面。
 * fumadocsRoster 与 components：组件名册。fumadocsRoster 放进 fumadocs 自带组件的机读规则，components 再加站里的组件；
 * 讲解组件的规则在组件旁的 .ai.mjs 里，读组件自己的讲解数据。
 * trajectory：轨迹卡放在站点根下的 trajectory/，站点的卡集合（app/features/trajectory/mdx.ts）读同一个目录。
 * 术语表不在这里：它是站点根的 glossary.json，由站点的 source.config.ts 交给术语标注插件。
 */
import * as seamMap from './content/docs/_shared/seam-map/seam-map.ai.mjs'
import * as launcherBoot from './content/docs/installer/launcher/launcher-boot/launcher-boot.ai.mjs'
import * as launcherCases from './content/docs/installer/launcher/launcher-cases/launcher-cases.ai.mjs'
import * as bootAndRequest from './content/docs/index/boot-and-request/boot-and-request.ai.mjs'
import * as kernelBoot from './content/docs/desktop/boot/kernel-boot/kernel-boot.ai.mjs'
import * as bootFailure from './content/docs/desktop/boot/boot-failure/boot-failure.ai.mjs'
import * as quitCleanup from './content/docs/desktop/boot/quit-cleanup/quit-cleanup.ai.mjs'
import * as homeLoad from './content/docs/desktop/home/home-load/home-load.ai.mjs'
import * as requestTrip from './content/docs/desktop/ipc/request-trip/request-trip.ai.mjs'
import * as requestOutcomes from './content/docs/desktop/ipc/request-outcomes/request-outcomes.ai.mjs'
import * as shellHandover from './content/docs/desktop/page/shell-handover/shell-handover.ai.mjs'
import * as importCases from './content/docs/desktop/page/import-cases/import-cases.ai.mjs'
import * as logSources from './content/docs/desktop/log/log-sources/log-sources.ai.mjs'

export default {
  content: 'content',
  outputs: {
    'content/docs/outputs/readme.mdx': ['../README.md'],
    'content/docs/outputs/agents.mdx': ['../AGENTS.md'],
    'content/docs/outputs/install.mdx': ['../INSTALL.md'],
    'content/docs/outputs/claude.mdx': ['../CLAUDE.md'],
  },
  fumadocsRoster: true,
  components: {
    // 手写的术语标注：机读版里只留术语原词
    Term: 'children',
    // fumadocs 的提示框：机读版里标题变成「[注意] 标题」一段，正文照原样保留
    Callout: (node, h) => [h.paragraph(`[注意] ${h.attr(node, 'title') ?? ''}`), ...h.children()],
    // 自包含的讲解组件：规则读组件自己的讲解数据，把每一步、每一条写成段落
    SeamMap: seamMap.SeamMap,
    LauncherBootSteps: launcherBoot.LauncherBootSteps,
    LauncherCases: launcherCases.LauncherCases,
    BootAndRequestSteps: bootAndRequest.BootAndRequestSteps,
    KernelBootSteps: kernelBoot.KernelBootSteps,
    BootFailureCases: bootFailure.BootFailureCases,
    QuitCleanupCases: quitCleanup.QuitCleanupCases,
    HomeLoadSteps: homeLoad.HomeLoadSteps,
    RequestTripSteps: requestTrip.RequestTripSteps,
    RequestOutcomes: requestOutcomes.RequestOutcomes,
    ShellHandoverSteps: shellHandover.ShellHandoverSteps,
    ImportCases: importCases.ImportCases,
    LogSources: logSources.LogSources,
  },
  trajectory: 'trajectory',
}
