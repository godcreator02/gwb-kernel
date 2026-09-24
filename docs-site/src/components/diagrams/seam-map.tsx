/**
 * 接缝图：虚线框是包，框里是模块；模块之间的连线是接缝，编号与入口页的接缝表一一对应。
 * 实线接缝有代码接口，点线接缝只靠约定。人与 AI 的入口画成灰色箭头，不编号。
 * 运行时内核应用、cordis、插件都装在 home 的 node_modules 里，包名旁边写明；安装包只带启动器。
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
    <svg viewBox="0 0 760 790" role="img" aria-label="内核仓的包、模块与九条接缝">
      <Package x={20} y={100} w={170} h={300} />
      <Package x={210} y={100} w={300} h={300} />
      <Package x={540} y={100} w={210} h={300} />
      <Package x={20} y={440} w={170} h={112} />
      <Package x={210} y={440} w={300} h={82} />
      <Package x={540} y={440} w={210} h={112} />
      <Package x={20} y={660} w={730} h={80} />

      <Arrow from={[80, 64]} to={[80, 132]} />
      <Arrow from={[690, 64]} to={[690, 132]} />

      <SeamLine d="M498,150 H552" />
      <SeamLine d="M498,198 H552" />
      <SeamLine d="M178,198 H222" />
      <SeamLine d="M150,132 V84 H594 V132" />
      <SeamLine d="M498,246 H552" />
      <SeamLine d="M715,362 V472" />
      <SeamLine d="M650,630 V682" byConvention />
      <SeamLine d="M498,294 H552" />
      <SeamLine d="M360,472 V400" byConvention />

      <Box x={40} y={24} w={120} h={40} lines={['人']} />
      <Box x={640} y={24} w={100} h={40} lines={['AI', '经 MCP']} />

      <Box x={32} y={132} w={146} h={40} lines={['页面入口', 'index.html · #root']} tone="a" />
      <Box x={32} y={180} w={146} h={36} lines={['window.gwb', 'preload.cjs']} tone="a" mono />
      <PackageLabel x={32} y={392} name="页面" path="渲染进程" />

      <PackageLabel x={222} y={120} name="内核应用" path="apps/desktop · 装进 home" />
      <Box x={222} y={132} w={276} h={36} lines={['包名解析', 'bare-import.ts']} tone="a" mono />
      <Box x={222} y={180} w={276} h={36} lines={['组装', 'main.ts']} tone="a" mono />
      <Box x={222} y={228} w={276} h={36} lines={['页面上的包名 · 带 react', 'imports.ts · dist/react/']} tone="a" mono />
      <Box x={222} y={276} w={276} h={36} lines={['日志', 'log-file.ts']} tone="a" mono />
      <Box x={222} y={324} w={276} h={36} lines={['只读状态页的数据', 'entry-state.ts']} tone="a" mono />

      <Box x={552} y={132} w={84} h={36} lines={['外壳']} />
      <Box x={646} y={132} w={92} h={36} lines={['MCP 入口']} />
      <Box x={552} y={180} w={186} h={132} lines={['任何插件', '数据 · 设置 · 说明书 …']} />
      <Box x={552} y={322} w={90} h={40} lines={['命令插件', 'gwb-commands']} />
      <Box x={648} y={322} w={90} h={40} lines={['插件管理', 'plugin-manager']} />
      <PackageLabel x={552} y={392} name="cordis.yml 里的插件" path="装进 home" />

      <PackageLabel x={32} y={460} name="词汇表包" />
      <Note x={32} y={476} size={10.5} mono>
        packages/gwb-plugin-api
      </Note>
      <Box x={32} y={484} w={146} h={58} lines={['只有类型', 'GwbKernelApi · GwbContext', 'GwbWindowApi · ShellBoot']} tone="a" />

      <PackageLabel x={222} y={460} name="安装包" path="apps/launcher · installer/" />
      <Box x={222} y={472} w={276} h={40} lines={['启动器（安装包里只有它与 Electron）', 'main.ts · launch-plan.ts']} tone="a" mono />

      <PackageLabel x={552} y={460} name="cordis" path="装进 home，只有一份" />
      <Box x={552} y={472} w={186} h={44} lines={['cordis 实例', 'loader · include']} />

      <Box x={560} y={590} w={180} h={40} lines={['外部工具', 'devkit · 装机的 agent']} />

      <PackageLabel x={32} y={702} name="home" />
      <Note x={32} y={718}>磁盘上的目录</Note>
      <Box x={140} y={682} w={100} h={32} lines={['package.json']} />
      <Box x={250} y={682} w={90} h={32} lines={['cordis.yml']} />
      <Box x={350} y={676} w={150} h={44} lines={['node_modules/', '内核包 · cordis · 插件']} />
      <Box x={510} y={682} w={80} h={32} lines={['gwb.log']} />
      <Box x={600} y={682} w={120} h={32} lines={['runtime.json']} />

      <Badge x={525} y={150} n={1} />
      <Badge x={525} y={198} n={2} />
      <Badge x={200} y={198} n={3} />
      <Badge x={372} y={84} n={4} />
      <Badge x={525} y={246} n={5} />
      <Badge x={715} y={420} n={6} />
      <Badge x={650} y={656} n={7} byConvention />
      <Badge x={525} y={294} n={8} />
      <Badge x={360} y={426} n={9} byConvention />

      <Note x={20} y={762}>虚线框是包；实线接缝有代码接口，点线接缝只靠约定；灰色箭头是人与 AI 的入口，不算接缝</Note>
      <Note x={20} y={780}>运行时内核应用、cordis 与插件都装在 home 的 node_modules 里；启动器按接缝 9 从那里加载内核</Note>
    </svg>
  )
}
