/**
 * 接缝图：虚线框是包，框里是模块；模块之间的连线是接缝，编号与接缝图页的表一一对应。
 * 实线接缝两侧有代码接口，点线接缝两侧只靠约定。人与 AI 的入口画成灰色箭头，不编号。
 */
import { Arrow, BG, Box, FG, MONO, MUTED, Note } from './parts'

const SEAM = 'var(--diagram-b)'

function Package({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke={MUTED} strokeWidth={1} strokeDasharray="5 4" />
}

function PackageLabel({ x, y, name, path, anchor = 'start' }: { x: number; y: number; name: string; path?: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={12.5} fontWeight={600} fill={FG}>
      {name}
      {path !== undefined && (
        <tspan dx={6} fontSize={11} fontWeight={400} fill={MUTED} fontFamily={MONO}>
          {path}
        </tspan>
      )}
    </text>
  )
}

function SeamLine({ d, byConvention }: { d: string; byConvention?: boolean }) {
  return <path d={d} fill="none" stroke={byConvention ? MUTED : SEAM} strokeWidth={1.4} strokeDasharray={byConvention ? '2 3' : undefined} />
}

function Badge({ x, y, n, byConvention }: { x: number; y: number; n: number; byConvention?: boolean }) {
  const color = byConvention ? MUTED : SEAM
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill={BG} stroke={color} strokeWidth={1.2} strokeDasharray={byConvention ? '2 2' : undefined} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} fill={color}>
        {n}
      </text>
    </g>
  )
}

export function SeamMap() {
  return (
    <svg viewBox="0 0 760 800" role="img" aria-label="内核仓的包、模块与十二条接缝">
      <Package x={20} y={100} w={170} h={300} />
      <Package x={210} y={100} w={300} h={300} />
      <Package x={540} y={100} w={210} h={300} />
      <Package x={20} y={440} w={170} h={112} />
      <Package x={210} y={440} w={300} h={112} />
      <Package x={540} y={440} w={210} h={112} />
      <Package x={210} y={590} w={300} h={82} />
      <Package x={20} y={700} w={730} h={70} />

      <Arrow from={[80, 64]} to={[80, 132]} />
      <Arrow from={[690, 64]} to={[690, 132]} />

      <SeamLine d="M498,150 H552" />
      <SeamLine d="M498,354 H552" />
      <SeamLine d="M498,494 H525 V370 H552" />
      <SeamLine d="M178,354 H222" />
      <SeamLine d="M150,132 V84 H594 V132" />
      <SeamLine d="M498,198 H552" />
      <SeamLine d="M360,374 V440" />
      <SeamLine d="M178,494 H222" />
      <SeamLine d="M287,516 V622" />
      <SeamLine d="M450,44 H640" byConvention />
      <SeamLine d="M660,640 V722" byConvention />
      <SeamLine d="M498,246 H552" />

      <Box x={40} y={24} w={120} h={40} lines={['人']} />
      <Box x={300} y={24} w={150} h={40} lines={['说明书', '随内置插件发布']} tone="a" />
      <Box x={640} y={24} w={100} h={40} lines={['AI', '经 MCP']} />

      <Box x={32} y={132} w={146} h={40} lines={['页面入口', 'index.html · #root']} tone="a" />
      <Box x={32} y={334} w={146} h={40} lines={['window.gwb', 'preload.cjs']} tone="a" mono />
      <PackageLabel x={32} y={392} name="页面" path="渲染进程" />

      <PackageLabel x={222} y={120} name="内核应用" path="apps/desktop" />
      <Box x={222} y={132} w={276} h={36} lines={['包名解析', 'bare-import.ts']} tone="a" mono />
      <Box x={222} y={180} w={276} h={36} lines={['页面上的包名', 'imports.ts']} tone="a" mono />
      <Box x={222} y={228} w={276} h={36} lines={['日志', 'log-file.ts']} tone="a" mono />
      <Box x={222} y={276} w={276} h={36} lines={['只读状态页的数据', 'entry-state.ts']} tone="a" mono />
      <Box x={222} y={334} w={276} h={40} lines={['组装', 'main.ts']} tone="a" mono />

      <Box x={552} y={132} w={84} h={36} lines={['外壳']} />
      <Box x={646} y={132} w={92} h={36} lines={['MCP 入口']} />
      <Box x={552} y={180} w={186} h={194} lines={['任何插件', '数据 · 设置 · 说明书插件 …']} />
      <PackageLabel x={552} y={392} name="cordis.yml 里的插件" />

      <PackageLabel x={32} y={460} name="cordis" path="外部依赖" />
      <Box x={32} y={472} w={146} h={44} lines={['cordis 实例', 'loader · include']} />

      <PackageLabel x={222} y={460} name="内置插件" path="plugins/" />
      <Box x={222} y={472} w={130} h={44} lines={['插件管理', 'plugin-manager']} tone="a" mono />
      <Box x={366} y={472} w={132} h={44} lines={['命令插件', 'commands']} tone="a" mono />

      <PackageLabel x={552} y={460} name="词汇表包" />
      <Note x={552} y={476} size={10.5} mono>
        packages/gwb-plugin-api
      </Note>
      <Box x={552} y={484} w={186} h={58} lines={['只有类型', 'GwbKernelApi · GwbCommands', 'GwbWindowApi · ShellBoot']} tone="a" />

      <PackageLabel x={498} y={610} name="安装包" path="installer/" anchor="end" />
      <Box x={222} y={622} w={130} h={38} lines={['pnpm.exe', 'resources/pnpm']} tone="a" mono />
      <Box x={366} y={622} w={132} h={38} lines={['外层引导脚本', 'bootstrap.mjs']} tone="a" mono />

      <Box x={560} y={600} w={180} h={40} lines={['外部工具', 'devkit · 装机的 agent']} />

      <PackageLabel x={32} y={742} name="home" />
      <Note x={32} y={758}>磁盘上的目录</Note>
      <Box x={140} y={722} w={100} h={32} lines={['package.json']} />
      <Box x={250} y={722} w={90} h={32} lines={['cordis.yml']} />
      <Box x={350} y={722} w={110} h={32} lines={['node_modules/']} />
      <Box x={470} y={722} w={80} h={32} lines={['gwb.log']} />
      <Box x={600} y={722} w={120} h={32} lines={['runtime.json']} />

      <Badge x={525} y={150} n={1} />
      <Badge x={525} y={354} n={2} />
      <Badge x={525} y={432} n={3} />
      <Badge x={200} y={354} n={4} />
      <Badge x={372} y={84} n={5} />
      <Badge x={525} y={198} n={6} />
      <Badge x={360} y={408} n={7} />
      <Badge x={200} y={494} n={8} />
      <Badge x={287} y={570} n={9} />
      <Badge x={545} y={44} n={10} byConvention />
      <Badge x={660} y={681} n={11} byConvention />
      <Badge x={525} y={246} n={12} />

      <Note x={20} y={792}>虚线框是包；实线接缝两侧有代码接口，点线接缝两侧只靠约定；灰色箭头是人与 AI 的入口，不算接缝</Note>
    </svg>
  )
}
