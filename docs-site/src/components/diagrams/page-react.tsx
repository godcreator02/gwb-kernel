/**
 * 页面上的 react：左边是页面入口 dist/index.html 里写死的 importmap，右边是内核包构建时打进 dist/react/ 的四个文件，
 * 下面是页面代码 import 时找到的文件。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note } from './parts'

const REACT_ENTRIES = [
  ['react', 'react.js'],
  ['react/jsx-runtime', 'react-jsx-runtime.js'],
  ['react-dom', 'react-dom.js'],
  ['react-dom/client', 'react-dom-client.js'],
] as const

export function PageReact() {
  return (
    <svg viewBox="0 0 760 270" role="img" aria-label="页面入口里写死的 importmap 把 react 的四个包名指向内核包 dist/react/ 里的文件">
      <Note x={16} y={22} size={12} color={FG} weight={600}>
        dist/index.html 的 importmap
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
      <Box x={400} y={54} w={344} h={82} lines={['内核包 dist/react/', '四个文件，构建时由', 'scripts/build-react.ts 打包']} tone="a" mono />
      <Note x={400} y={156}>
        react 与 react-dom 是内核包的开发依赖
      </Note>

      <Arrow from={[181, 160]} to={[181, 196]} />
      <Box x={16} y={196} w={330} h={46} lines={["页面代码：import 'react'", '全页只有一份 react']} tone="a" />
    </svg>
  )
}
