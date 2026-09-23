'use client'

/**
 * home 与插件管理：左边是调用方（agent 或插件管理窗格），中间是 plugin-manager，右边上半是 home 里的文件，
 * 右边下半是内核（loader 条目树与按真实路径解析）。分步走一遍安装与一键热升级；`flow` 只放其中一段
 */

import { Arrow, Box, BORDER, FG, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

type Part = 'caller' | 'manager' | 'queue' | 'package' | 'modules' | 'yml' | 'tree' | 'resolve' | 'shell'

type Flow = 'install' | 'upgrade'

const ALL_STEPS: { title: string; detail: string; lit: Part[]; arrow?: 'call' | 'pnpm' | 'tree' | 'reload'; flow?: Flow }[] = [
  { title: '全貌', detail: '只有 plugin-manager 写 home：pnpm 改 package.json 与 node_modules，loader 的条目树改 cordis.yml。它用到的 loader 结构与解析规则由内核决定。', lit: [] },
  { title: '安装 1：调用 plugin-manager.install', detail: 'agent 或插件管理窗格按包名调用；同一时刻只允许一个改动，重入的直接返回 BUSY。', lit: ['caller', 'manager'], arrow: 'call', flow: 'install' },
  { title: '安装 2：一次 pnpm add', detail: '经 applyToHome 排进串行队列，把包写进 home 的 package.json 与 node_modules。过渡期里，该进 home 的 peer 也装成直接依赖。', lit: ['queue', 'package', 'modules'], arrow: 'pnpm', flow: 'install' },
  { title: '安装 3：加一条条目', detail: '经 loader 条目树 create：写回 cordis.yml 并当场加载。loader 要 import 包名时由内核按真实路径解析。', lit: ['tree', 'yml', 'resolve'], arrow: 'tree', flow: 'install' },
  { title: '热升级 1：一次 pnpm add 精确版本', detail: 'outdated 查出过期包，一次 pnpm add 把它们都升到精确版本；旧版本目录随即被 pnpm 删除。', lit: ['queue', 'package', 'modules'], arrow: 'pnpm', flow: 'upgrade' },
  { title: '热升级 2：逐条停用再启用', detail: '同一条命令里每条条目停用再启用。真实路径带版本号，内核重新解析就拿到新版本；plugin-manager 自己排最后、回执之后才动。', lit: ['tree', 'resolve'], arrow: 'tree', flow: 'upgrade' },
  { title: '热升级 3：整页重新加载', detail: '调用命令 shell.reload，页面重新加载，窗格拿到新版本的页面代码。', lit: ['shell'], arrow: 'reload', flow: 'upgrade' },
]

export function PluginHome({ flow }: { flow?: Flow }) {
  const STEPS = ALL_STEPS.filter((step) => flow === undefined || step.flow === undefined || step.flow === flow)
  const state = useSteps(STEPS.length, 3000)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const arrowTone = (name: string) => (current.arrow === name ? 'a' : undefined)

  return (
    <>
      <svg viewBox="0 0 760 360" role="img" aria-label="plugin-manager 怎么安装与热升级插件">
        <Box x={14} y={60} w={140} h={60} lines={['调用方', 'agent 或插件管理窗格']} tone={lit('caller')} />

        <Note x={186} y={26} size={12} color={FG} weight={600}>
          plugin-manager（插件）
        </Note>
        <rect x={178} y={36} width={230} height={196} rx={10} fill="none" stroke={BORDER} />
        <Box x={192} y={50} w={202} h={56} lines={['命令 plugin-manager.*', '同一时刻只允许一个改动']} tone={lit('manager')} />
        <Box x={192} y={118} w={202} h={50} lines={['applyToHome', '唯一运行 pnpm 的入口，串行排队']} tone={lit('queue')} />
        <Box x={192} y={176} w={202} h={44} lines={['条目树（从自己的条目上取）']} tone={lit('tree')} />

        <Note x={440} y={26} size={12} color={FG} weight={600}>
          home（磁盘）
        </Note>
        <rect x={432} y={36} width={314} height={100} rx={10} fill="none" stroke={BORDER} />
        <Box x={444} y={50} w={92} h={70} lines={['package.json', '装了哪些包']} tone={lit('package')} />
        <Box x={546} y={50} w={92} h={70} lines={['node_modules/', '包本体']} tone={lit('modules')} />
        <Box x={648} y={50} w={88} h={70} lines={['cordis.yml', '条目']} tone={lit('yml')} />

        <Note x={440} y={166} size={12} color={FG} weight={600}>
          内核
        </Note>
        <rect x={432} y={176} width={314} height={100} rx={10} fill="none" stroke={BORDER} />
        <Box x={444} y={190} w={140} h={72} lines={['loader + include', '条目树的结构', '读写 cordis.yml']} tone={lit('tree')} />
        <Box x={596} y={190} w={140} h={72} lines={['按真实路径解析', '包名 → 带版本号的目录']} tone={lit('resolve')} />

        <Box x={192} y={250} w={202} h={40} lines={['shell.reload（外壳的命令）']} tone={lit('shell')} dashed={current.arrow !== 'reload'} />

        <Arrow from={[154, 90]} to={[192, 78]} tone={arrowTone('call')} />
        <Arrow from={[394, 143]} to={[444, 100]} tone={arrowTone('pnpm')} />
        <Arrow from={[394, 198]} to={[444, 222]} tone={arrowTone('tree')} />
        <Arrow from={[293, 220]} to={[293, 250]} tone={arrowTone('reload')} />
        <line x1={690} y1={120} x2={690} y2={190} stroke={MUTED} strokeDasharray="3 3" />

        <StepCaption x={20} y={308} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
