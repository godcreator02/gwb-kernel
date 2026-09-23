'use client'

/**
 * 安装一个包的五步：左边一列是步骤（虚线框是过渡期的两步），第 5 步分叉成「库」与「插件」两条路；
 * 右上是这一步碰到的 home 文件，右中是这一步失败时回执的样子，右下是到这一步为止回执里有哪几行。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

type Part = 'check' | 'add' | 'peers' | 'warn' | 'kind' | 'lib' | 'plugin' | 'package' | 'yml' | 'load'

interface Step {
  title: string
  detail: string
  lit: Part[]
  /** 这一步失败时回执长什么样 */
  failure: string
  /** 到这一步为止回执里有哪几行 */
  receipt: string[]
}

const STEPS: Step[] = [
  {
    title: '全貌',
    detail: '五步依次做；只有参数写错才抛错，其余每一种失败都转成 ok: false 的回执。第 3、4 步是过渡期的做法。',
    lit: [],
    failure: '每一步的失败方式，逐步点亮时显示',
    receipt: ['{ ok, pkg, … }'],
  },
  {
    title: '第 1 步：校验参数',
    detail: '包名与版本范围不合规就抛错——拦的是 -r 这类会被 pnpm 当成命令行选项的参数。参数以数组传给 pnpm，不经过 shell。',
    lit: ['check'],
    failure: '参数不合规 → 直接抛错（调用方写错了）',
    receipt: ['{ pkg: "@x/gwb-foo"'],
  },
  {
    title: '第 2 步：一次 pnpm add',
    detail: '先找 pnpm，再经 applyToHome 排进串行队列运行。包写进 home 的 package.json 与 node_modules。',
    lit: ['add', 'package'],
    failure: '找不到 pnpm、pnpm 失败 → ok: false，带 pnpm 输出的最后几行',
    receipt: ['{ pkg: "@x/gwb-foo", ok: true'],
  },
  {
    title: '第 3 步：peer 那一步（过渡期）',
    detail: '该进 home 的 peer 逐条单独 pnpm add，装成 home 的直接依赖。排在建条目之前：条目一加，插件就开始加载。',
    lit: ['peers', 'package'],
    failure: 'peer 装不上 → 不让安装失败，写进 peers 与 note',
    receipt: ['{ pkg: "@x/gwb-foo", ok: true', '  peers: [{ pkg, range, action }]'],
  },
  {
    title: '第 4 步：查 peer 版本（过渡期）',
    detail: '运行一次 pnpm peers check，home 整棵依赖树里版本对不上的每一处写进 peerWarnings，只提醒、不拦。',
    lit: ['warn'],
    failure: '结果读不出来 → note 里说一句，安装照样算成功',
    receipt: ['{ pkg: "@x/gwb-foo", ok: true', '  peers: [{ pkg, range, action }]', '  peerWarnings?: [{ peer, wanted, by }]'],
  },
  {
    title: '第 5 步（是库）：不加条目',
    detail: '清单 keywords 写了 gwb、没写 gwb-plugin 的是库。库没有 apply，加了条目也加载不起来，所以不加，回执里没有 entryId。',
    lit: ['kind', 'lib'],
    failure: '—（包已经装上，不算失败）',
    receipt: ['{ pkg: "@x/gwb-foo", ok: true', '  peers: [{ pkg, range, action }]', '  peerWarnings?: [{ peer, wanted, by }]', '  note: "…是库不是插件，没建条目" }'],
  },
  {
    title: '第 5 步（是插件）：选 id，加一条条目',
    detail: '选好 id，经条目树 create 写回 cordis.yml。加载在后台继续，命令不等它——等了的话，依赖没装齐的插件会让命令永远没有回执。',
    lit: ['kind', 'plugin', 'yml', 'load'],
    failure: '写不进 cordis.yml → ok: false，包留在 home 里，不回滚',
    receipt: ['{ pkg: "@x/gwb-foo", ok: true', '  peers: [{ pkg, range, action }]', '  peerWarnings?: [{ peer, wanted, by }]', '  entryId: "home:foo" }'],
  },
]

export function PmInstall() {
  const state = useSteps(STEPS.length, 3200)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)

  return (
    <>
      <svg viewBox="0 0 760 440" role="img" aria-label="安装一个包的五步">
        <Box x={20} y={16} w={250} h={42} lines={['1 校验参数', '包名、版本范围']} tone={lit('check')} />
        <Box x={20} y={74} w={250} h={42} lines={['2 一次 pnpm add', '经 applyToHome 串行运行']} tone={lit('add')} />
        <Box x={20} y={132} w={250} h={42} lines={['3 peer 那一步', '过渡期：peer 装成直接依赖']} tone={lit('peers')} dashed />
        <Box x={20} y={190} w={250} h={42} lines={['4 查 peer 版本', '过渡期：pnpm peers check']} tone={lit('warn')} dashed />
        <Box x={20} y={248} w={250} h={42} lines={['5 是库还是插件？', 'keywords 里有没有 gwb-plugin']} tone={lit('kind')} />
        <Box x={20} y={320} w={118} h={42} lines={['库', '不加条目']} tone={lit('lib')} />
        <Box x={152} y={320} w={118} h={42} lines={['插件', '选 id，加条目']} tone={lit('plugin')} />
        <Arrow from={[145, 58]} to={[145, 74]} />
        <Arrow from={[145, 116]} to={[145, 132]} />
        <Arrow from={[145, 174]} to={[145, 190]} />
        <Arrow from={[145, 232]} to={[145, 248]} />
        <Arrow from={[110, 290]} to={[79, 320]} />
        <Arrow from={[180, 290]} to={[211, 320]} />

        <Note x={318} y={24} size={12} color={FG} weight={600}>
          home（磁盘）
        </Note>
        <rect x={310} y={32} width={436} height={110} rx={10} fill="none" stroke={BORDER} />
        <Box x={322} y={46} w={200} h={40} lines={['package.json + node_modules/', 'pnpm 改']} tone={lit('package')} />
        <Box x={534} y={46} w={200} h={40} lines={['cordis.yml', '条目树 create 写回']} tone={lit('yml')} />
        <Box x={534} y={94} w={200} h={40} lines={['loader 加载这条条目', '在后台继续，命令不等']} tone={lit('load')} dashed />

        <Note x={318} y={166} size={12} color={FG} weight={600}>
          这一步失败时
        </Note>
        <rect x={310} y={174} width={436} height={40} rx={8} fill="none" stroke={BORDER} />
        <Note x={324} y={198} size={12} color={current.lit.length === 0 ? MUTED : FG}>
          {current.failure}
        </Note>

        <Note x={318} y={238} size={12} color={FG} weight={600}>
          回执（到这一步为止）
        </Note>
        <rect x={310} y={246} width={436} height={116} rx={8} fill="none" stroke={BORDER} />
        {current.receipt.map((line, index) => (
          <text key={line} x={324} y={270 + index * 22} fontSize={12} fill={FG} fontFamily={MONO} style={{ whiteSpace: 'pre' }}>
            {line}
          </text>
        ))}

        <StepCaption x={20} y={392} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
