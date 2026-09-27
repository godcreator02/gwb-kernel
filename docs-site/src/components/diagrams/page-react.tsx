/** 提供方交出 URL，内核登记，preload 准备后页面才 import。 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note } from './parts'

const REACT_ENTRIES = [
  ['react', 'react.js'],
  ['react/jsx-runtime', 'react-jsx-runtime.js'],
  ['react-dom', 'react-dom.js'],
  ['react-dom/client', 'react-dom-client.js'],
] as const

export function PageReact() {
  return (
    <svg viewBox="0 0 760 270" role="img" aria-label="shell 登记 React 地址，内核准备 importmap 后页面加载">
      <Note x={16} y={22} size={12} color={FG} weight={600}>
        shell 的 browserImports()
      </Note>
      <rect x={16} y={30} width={330} height={130} rx={8} fill="none" stroke={BORDER} />
      {REACT_ENTRIES.map(([name, file], index) => {
        const y = 52 + index * 30
        return (
          <g key={name}>
            <text x={32} y={y} dominantBaseline="middle" fontSize={11.5} fontFamily={MONO} fill={FG}>
              {name}
            </text>
            <text x={330} y={y} dominantBaseline="middle" textAnchor="end" fontSize={11} fontFamily={MONO} fill={MUTED}>
              ./react/{file}
            </text>
          </g>
        )
      })}

      <Arrow from={[346, 95]} to={[400, 95]} />
      <Box x={400} y={54} w={344} h={82} lines={['kernel.registerImports', '原子登记、同名冲突校验', 'preload.prepareImports 注入']} tone="a" mono />
      <Note x={400} y={156}>
        React 文件与版本在 shell 的 dist/react/
      </Note>

      <Arrow from={[181, 160]} to={[181, 196]} />
      <Box x={16} y={196} w={330} h={46} lines={["页面代码：import 'react'", '先 prepareImports，再动态 import']} tone="a" />
    </svg>
  )
}
