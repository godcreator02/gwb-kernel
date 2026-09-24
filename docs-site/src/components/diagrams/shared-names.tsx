'use client'

/**
 * 页面上的包名：左边是写了 gwb.shared 的包清单（内核包自己、插件），中间是内核每次推送时重新计算的 collectImports，
 * 右边是推给页面的 importmap。四步：内核的名字先收、插件声明别的名字、插件声明了内核的名字被忽略、两个插件撞名被拒绝。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

const KERNEL_NAMES = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']
const PLUGIN_NAME = 'some-lib'

const STEPS = [
  {
    title: '第 1 步：内核的名字先收',
    detail: '内核包自己的清单声明 react 的四个包名，启动时解析到内核包 dist/react/ 里打包好的文件，每次推送都先放进表里。',
  },
  {
    title: '第 2 步：插件声明别的名字',
    detail: '插件在清单里写 gwb.shared（这里是 some-lib）。collectImports 扫 home 清单里的每个包，按 home 解析成 file:// 地址，随 gwb:shell 推给页面。',
  },
  {
    title: '第 3 步：插件声明了内核的名字',
    detail: '比如旧版 shell 还声明着 react：它的声明被忽略，react 仍指向内核那份；内核记一条 warn，同一句只记一次。',
  },
  {
    title: '第 4 步：两个插件撞名',
    detail: '又有一个插件声明了 some-lib：两个都不收录，内核记一条 warn，页面 import 它直接报解析错误；别的名字不受影响。',
  },
]

export function SharedNames() {
  const state = useSteps(STEPS.length, 3200)
  const step = state.step
  const current = STEPS[step]!
  const pluginDeclared = step >= 1
  const kernelNameClaimed = step === 2
  const pluginClash = step === 3

  const thirdBoxLines = pluginClash ? ['另一个插件的 package.json', `gwb.shared: ${PLUGIN_NAME} → …`] : ['旧版 shell 的 package.json', 'gwb.shared: react → …']
  const thirdBoxActive = kernelNameClaimed || pluginClash

  const rows = [...KERNEL_NAMES, PLUGIN_NAME]

  return (
    <>
      <svg viewBox="0 0 760 380" role="img" aria-label="内核包与插件清单里的 gwb.shared 怎么变成页面上的 importmap">
        <Box x={16} y={20} w={230} h={92} lines={['内核包的 package.json', 'gwb.shared:', 'react → ./react', '（共四个名字）']} tone="a" mono />
        <Box
          x={16}
          y={126}
          w={230}
          h={52}
          lines={['插件的 package.json', `gwb.shared: ${PLUGIN_NAME} → …`]}
          tone={pluginDeclared ? 'a' : undefined}
          dashed={!pluginDeclared}
          dim={!pluginDeclared}
          mono
        />
        <Box x={16} y={192} w={230} h={52} lines={thirdBoxLines} tone={thirdBoxActive ? 'b' : undefined} dashed={!thirdBoxActive} dim={!thirdBoxActive} mono />

        <Arrow from={[246, 66]} to={[284, 112]} />
        <Arrow from={[246, 152]} to={[284, 132]} dashed={!pluginDeclared} />
        <Arrow from={[246, 218]} to={[284, 148]} dashed={!thirdBoxActive} />
        <Box x={284} y={100} w={150} h={58} lines={['collectImports', '每次推送时重新计算']} />
        <Arrow from={[434, 129]} to={[466, 129]} />

        <Note x={466} y={22} size={12} color={FG} weight={600}>
          importmap（推给页面）
        </Note>
        <rect x={466} y={30} width={278} height={160} rx={8} fill="none" stroke={BORDER} />
        {rows.map((name, index) => {
          const y = 52 + index * 30
          const isPluginRow = name === PLUGIN_NAME
          const hidden = isPluginRow && !pluginDeclared
          const rejected = isPluginRow && pluginClash
          const highlighted = (step === 0 && !isPluginRow) || (step === 1 && isPluginRow) || (kernelNameClaimed && name === 'react')
          const target = isPluginRow ? (rejected ? '两个提供方，不收录' : 'file://…插件包') : kernelNameClaimed && name === 'react' ? '仍是内核那份（插件的忽略）' : 'file://…内核包'
          if (hidden) return null
          return (
            <g key={name}>
              {highlighted && <rect x={474} y={y - 13} width={262} height={24} rx={5} fill="var(--diagram-a-soft)" stroke="var(--diagram-a)" />}
              <text x={482} y={y} dominantBaseline="middle" fontSize={11.5} fontFamily={MONO} fill={rejected ? MUTED : FG} textDecoration={rejected ? 'line-through' : undefined}>
                {name}
              </text>
              <text x={728} y={y} dominantBaseline="middle" textAnchor="end" fontSize={11} fontFamily={MONO} fill={rejected ? 'var(--diagram-b)' : MUTED}>
                {target}
              </text>
            </g>
          )
        })}

        <Box
          x={466}
          y={206}
          w={278}
          h={46}
          lines={[pluginClash ? `页面：import '${PLUGIN_NAME}'` : "页面：import 'react'", pluginClash ? '解析错误' : '找到内核包里的文件']}
          tone={pluginClash ? 'b' : 'a'}
        />

        <StepCaption x={20} y={290} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
