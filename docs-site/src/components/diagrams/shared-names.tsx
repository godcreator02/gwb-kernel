'use client'

/**
 * 页面上的包名：左边是在包清单里写了 gwb.shared 的包，中间是内核每次推送时重新计算的 collectImports，
 * 右边是推给页面的 importmap。三步：一个提供方、页面查表、第二个提供方声明同一个名字后这个名字被拒绝。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

const NAMES = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

const STEPS = [
  { title: '第 1 步：提供方声明', detail: 'shell 在自己的包清单里写 gwb.shared：包名 → 包里的导出子路径。内核按 home 解析成真实文件的 file:// 地址。' },
  { title: '第 2 步：页面查表', detail: '插件在页面里运行的代码写 import \'react\'，浏览器按 importmap 找到 shell 包里的那个文件。整个页面只有这一份 react。' },
  { title: '第 3 步：两个提供方撞名', detail: '又有一个包声明了 react：两个都不收录，内核记一条 warn。页面 import \'react\' 直接报解析错误；另外三个名字不受影响。' },
]

export function SharedNames() {
  const state = useSteps(STEPS.length, 3200)
  const step = state.step
  const current = STEPS[step]!
  const clash = step === 2

  return (
    <>
      <svg viewBox="0 0 760 330" role="img" aria-label="包清单里的 gwb.shared 怎么变成页面上的 importmap">
        <Box x={16} y={36} w={220} h={104} lines={['shell 的 package.json', 'gwb.shared:', 'react → ./react', 'react-dom/client → …', '（共四个名字）']} tone="a" mono />
        <Box x={16} y={156} w={220} h={62} lines={['另一个包的 package.json', 'gwb.shared: react → …']} tone={clash ? 'b' : undefined} dashed={!clash} dim={!clash} mono />

        <Arrow from={[236, 88]} to={[282, 112]} />
        <Arrow from={[236, 186]} to={[282, 138]} dashed={!clash} />
        <Box x={282} y={96} w={150} h={58} lines={['collectImports', '每次推送时重新计算']} />
        <Arrow from={[432, 125]} to={[466, 125]} />

        <Note x={466} y={28} size={12} color={FG} weight={600}>
          importmap（推给页面）
        </Note>
        <rect x={466} y={36} width={278} height={140} rx={8} fill="none" stroke={BORDER} />
        {NAMES.map((name, index) => {
          const y = 58 + index * 30
          const rejected = clash && name === 'react'
          const picked = step === 1 && name === 'react'
          return (
            <g key={name}>
              {picked && <rect x={474} y={y - 13} width={262} height={24} rx={5} fill="var(--diagram-a-soft)" stroke="var(--diagram-a)" />}
              <text x={482} y={y} dominantBaseline="middle" fontSize={11.5} fontFamily={MONO} fill={rejected ? MUTED : FG} textDecoration={rejected ? 'line-through' : undefined}>
                {name}
              </text>
              <text x={728} y={y} dominantBaseline="middle" textAnchor="end" fontSize={11} fontFamily={MONO} fill={rejected ? 'var(--diagram-b)' : MUTED}>
                {rejected ? '两个提供方，不收录' : 'file://…'}
              </text>
            </g>
          )
        })}

        <Box x={466} y={196} w={278} h={46} lines={["页面：import 'react'", step === 0 ? '—' : clash ? '解析错误' : '找到 shell 包里的文件']} tone={step === 1 ? 'a' : clash ? 'b' : undefined} />

        <StepCaption x={20} y={270} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
