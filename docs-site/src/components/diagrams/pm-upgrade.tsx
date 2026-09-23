'use client'

/**
 * 一键热升级的时间线：横轴是时间，每条横道是一个参与方。每一步在它那条横道上点亮一个方框；
 * 已经发生的保持显示，还没发生的调淡。竖虚线是回执发出的时刻：前面每一步都在这条命令里做完。
 */

import { Box, BORDER, FG, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

const LANES = ['调用方', 'plugin-manager', '磁盘 node_modules', '条目 A（被升级的插件）', '外壳']

interface Event {
  lane: number
  lines: string[]
}

const STEPS: { title: string; detail: string; events: Event[] }[] = [
  {
    title: '调用 update-all，定计划',
    detail: '先查过期包，再由纯函数算出计划：升哪些包、每个包的每条条目都要重新加载。插件管理与命令插件内置在内核里，不在计划里。',
    events: [
      { lane: 0, lines: ['update-all'] },
      { lane: 1, lines: ['查过期包', '定计划'] },
    ],
  },
  {
    title: '一次 pnpm add 精确版本',
    detail: '一次装完全部过期包，用查到的版本号而不是 @latest。pnpm 装上 A@1.1 的同时删掉 A@1.0 的目录；这一步失败就一条条目都不动。',
    events: [
      { lane: 1, lines: ['一次', 'pnpm add'] },
      { lane: 2, lines: ['A@1.0 删掉', 'A@1.1 装上'] },
    ],
  },
  {
    title: '条目 A 停用再启用',
    detail: '在同一条命令里做：停用 → 等旧的卸载完 → 启用 → 等新的加载完。启用时按真实路径重新解析，拿到的就是 A@1.1。',
    events: [{ lane: 3, lines: ['停用→启用', 'ACTIVE'] }],
  },
  {
    title: '整页重新加载',
    detail: '经命令插件调用外壳的 shell.reload，窗格拿到新版本的页面代码。命令表里没有它时，回执里的 reload 是 unavailable。',
    events: [{ lane: 4, lines: ['shell', '.reload'] }],
  },
  {
    title: '回执发出',
    detail: '回执里是每个包升级前后的版本、每条条目重新加载后的状态，以及 reload 是 done 还是 unavailable。',
    events: [{ lane: 0, lines: ['收到回执'] }],
  },
]

const LANE_Y = (lane: number) => 34 + lane * 48
const COL_X = (step: number) => 176 + step * 110

export function PmUpgrade() {
  const all = [{ title: '全貌', detail: '一条命令里按时间先后做完：定计划 → 一次 pnpm add → 逐条停用再启用 → 整页重新加载 → 回执。', events: [] as Event[] }, ...STEPS]
  const state = useSteps(all.length, 3000)
  const current = all[state.step]!
  const replyX = COL_X(4) - 8

  return (
    <>
      <svg viewBox="0 0 760 366" role="img" aria-label="一键热升级的时间线">
        {LANES.map((lane, index) => (
          <g key={lane}>
            <line x1={14} y1={LANE_Y(index) + 40} x2={746} y2={LANE_Y(index) + 40} stroke={BORDER} />
            <Note x={16} y={LANE_Y(index) + 24} size={11.5} color={FG}>
              {lane}
            </Note>
          </g>
        ))}
        <line x1={replyX} y1={24} x2={replyX} y2={LANE_Y(LANES.length - 1) + 40} stroke={MUTED} strokeDasharray="4 4" />
        <Note x={replyX + 4} y={20} size={11} color={MUTED}>
          回执发出
        </Note>

        {STEPS.map((step, index) => {
          const at = index + 1
          const tone = state.step === at ? 'a' : undefined
          const dim = state.step !== 0 && at > state.step
          return step.events.map((event) => (
            <Box key={`${at}-${event.lane}`} x={COL_X(index)} y={LANE_Y(event.lane) + 4} w={84} h={34} lines={event.lines} tone={tone} dim={dim} />
          ))
        })}

        <Note x={746} y={LANE_Y(LANES.length - 1) + 56} anchor="end" size={11} color={MUTED}>
          时间 →
        </Note>
        <StepCaption x={20} y={308} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={all.length} state={state} />
    </>
  )
}
