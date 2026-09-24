/**
 * 页面上的包名：左边是内核包清单里的 gwb.shared，中间是内核启动时算一次的 kernelSharedImports，
 * 右边是随 gwb:shell 推给页面的 importmap，下面是页面代码 import 时找到的文件。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note } from './parts'

const KERNEL_NAMES = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

export function SharedNames() {
  return (
    <svg viewBox="0 0 760 270" role="img" aria-label="内核包清单里声明的四个包名怎么变成页面上的 importmap">
      <Box x={16} y={36} w={230} h={92} lines={['内核包的 package.json', 'gwb.shared:', 'react → ./react', '（共四个名字）']} tone="a" mono />
      <Note x={16} y={156}>
        解析不到：内核启动失败（内核包不完整）
      </Note>
      <Note x={16} y={176}>
        home 里别的包写的 gwb.shared：内核不读
      </Note>

      <Arrow from={[246, 82]} to={[278, 82]} />
      <Box x={278} y={54} w={162} h={56} lines={['kernelSharedImports', '内核启动时算一次']} />
      <Arrow from={[440, 82]} to={[466, 82]} />

      <Note x={466} y={22} size={12} color={FG} weight={600}>
        importmap（随 gwb:shell 推给页面）
      </Note>
      <rect x={466} y={30} width={278} height={130} rx={8} fill="none" stroke={BORDER} />
      {KERNEL_NAMES.map((name, index) => {
        const y = 52 + index * 30
        return (
          <g key={name}>
            <text x={482} y={y} dominantBaseline="middle" fontSize={11.5} fontFamily={MONO} fill={FG}>
              {name}
            </text>
            <text x={728} y={y} dominantBaseline="middle" textAnchor="end" fontSize={11} fontFamily={MONO} fill={MUTED}>
              file://…内核包
            </text>
          </g>
        )
      })}

      <Arrow from={[605, 160]} to={[605, 196]} />
      <Box x={466} y={196} w={278} h={46} lines={["页面代码：import 'react'", '找到内核包 dist/react/ 里的文件']} tone="a" />
    </svg>
  )
}
