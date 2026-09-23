/**
 * K2：构建产物里留下的每一句包名 import，运行时由谁提供，于是清单里怎么写。
 * 最后一行是反例：自己用的库应该打包进产物，产物里不该留下它的 import。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note } from './parts'

const ROWS: { code: string; where: string; provider: [string, string]; tone?: 'a' | 'b'; wrong?: boolean }[] = [
  { code: "import { Service } from 'cordis'", where: '主进程代码', provider: ['home 里的 cordis', '写 peer cordis'], tone: 'a' },
  { code: "import fs from 'node:fs'", where: '主进程代码', provider: ['运行环境自带', '不声明'] },
  { code: "import { createRoot } from 'react-dom/client'", where: '浏览器端代码', provider: ['页面的 importmap（shell 提供）', '写 dev，构建时外置'] },
  { code: "import { parse } from 'yaml'", where: '自己用的库', provider: ['应该打包进构建产物', '写 dev，产物里不该有这一句'], tone: 'b', wrong: true },
]

export function RuntimeProviders() {
  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="构建产物里的包名 import 各由谁提供">
      <Note x={16} y={22} size={12} color={FG} weight={600}>
        构建产物里的一句
      </Note>
      <Note x={470} y={22} size={12} color={FG} weight={600}>
        运行时由谁提供 → 清单怎么写
      </Note>
      {ROWS.map((row, index) => {
        const y = 36 + index * 64
        return (
          <g key={row.code}>
            <rect x={16} y={y} width={400} height={48} rx={8} fill="none" stroke={BORDER} />
            <text x={30} y={y + 20} fontSize={12} fontFamily={MONO} fill={row.wrong ? MUTED : FG} textDecoration={row.wrong ? 'line-through' : undefined}>
              {row.code}
            </text>
            <text x={30} y={y + 38} fontSize={10.5} fill={MUTED}>
              {row.where}
            </text>
            <Arrow from={[416, y + 24]} to={[470, y + 24]} dashed={row.wrong} />
            <Box x={470} y={y} w={274} h={48} lines={row.provider} tone={row.tone} />
          </g>
        )
      })}
    </svg>
  )
}
