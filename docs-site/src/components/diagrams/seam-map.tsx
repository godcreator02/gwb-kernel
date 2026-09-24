/**
 * 接缝图：虚线框按模块所在的位置分组，框里是模块；模块之间的连线是接缝，编号与入口页的接缝表一一对应。
 * 实线接缝有代码接口，点线接缝只靠约定。人与 AI 的入口画成灰色箭头，不编号。
 * 连线停在框的边上，表示接的是整组（比如接缝 1 接的是 cordis.yml 里的每一个插件）。
 */
import { Arrow, BG, Box, FG, MONO, MUTED, Note } from './parts'

const SEAM = 'var(--diagram-b)'

function Group({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke={MUTED} strokeWidth={1} strokeDasharray="5 4" />
}

function GroupLabel({ x, y, name, where }: { x: number; y: number; name: string; where?: string }) {
  return (
    <text x={x} y={y} fontSize={12.5} fontWeight={600} fill={FG}>
      {name}
      {where !== undefined && (
        <tspan dx={6} fontSize={11} fontWeight={400} fill={MUTED} fontFamily={MONO}>
          {where}
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
    <svg viewBox="0 0 780 842" role="img" aria-label="内核仓的模块与十条接缝">
      <Group x={20} y={100} w={170} h={420} />
      <Group x={210} y={100} w={310} h={420} />
      <Group x={540} y={100} w={220} h={290} />
      <Group x={210} y={546} w={310} h={76} />
      <Group x={540} y={546} w={220} h={64} />
      <Group x={20} y={700} w={740} h={76} />

      <Arrow from={[60, 64]} to={[60, 132]} />
      <Arrow from={[704, 64]} to={[704, 132]} />

      <SeamLine d="M510,150 H540" />
      <SeamLine d="M510,198 H552" />
      <SeamLine d="M178,270 H222" />
      <SeamLine d="M150,132 V84 H600 V132" />
      <SeamLine d="M178,442 H222" />
      <SeamLine d="M510,294 H552" />
      <SeamLine d="M675,666 V726" byConvention />
      <SeamLine d="M510,342 H552" />
      <SeamLine d="M470,572 V520" byConvention />
      <SeamLine d="M510,246 H552" />

      <Box x={40} y={24} w={120} h={40} lines={['人']} />
      <Box x={650} y={24} w={108} h={40} lines={['AI', '经 MCP 入口']} />

      <GroupLabel x={32} y={120} name="页面" where="渲染进程" />
      <Box x={32} y={132} w={146} h={40} lines={['页面入口', 'index.html · #root']} tone="a" mono />
      <Box x={32} y={252} w={146} h={36} lines={['window.gwb', 'preload.cjs']} tone="a" mono />
      <Note x={32} y={308} size={10.5}>
        这两个文件随内核包发布，
      </Note>
      <Note x={32} y={324} size={10.5}>
        在页面里运行
      </Note>
      <Box x={32} y={422} w={146} h={40} lines={['页面代码', '外壳 · 插件的窗格']} />

      <GroupLabel x={222} y={120} name="内核应用" where="apps/desktop · 装进 home" />
      <Box x={222} y={132} w={288} h={36} lines={['包名解析', 'bare-import.ts']} tone="a" mono />
      <Box x={222} y={180} w={288} h={36} lines={['loader · include', '内核包的依赖，版本写死']} tone="a" />
      <Box x={222} y={228} w={288} h={84} lines={['组装', 'main.ts', 'gwbKernel · IPC · 窗口 · runtime.json']} tone="a" mono />
      <Box x={222} y={324} w={288} h={36} lines={['日志', 'log-file.ts · 写 gwb.log']} tone="a" mono />
      <Box x={222} y={372} w={288} h={36} lines={['只读状态页的数据', 'entry-state.ts']} tone="a" mono />
      <Box x={222} y={424} w={288} h={36} lines={['页面上的包名 · react', 'imports.ts · dist/react/']} tone="a" mono />
      <Box x={222} y={472} w={288} h={36} lines={['接口类型（包根导出）', 'api.ts · GwbContext 等，只有类型']} tone="a" mono />

      <GroupLabel x={552} y={120} name="cordis.yml 里的插件" where="装进 home" />
      <Box x={552} y={132} w={92} h={36} lines={['外壳']} />
      <Box x={654} y={132} w={94} h={36} lines={['MCP 入口']} />
      <Box x={552} y={180} w={196} h={36} lines={['插件管理', 'gwb-plugin-manager']} mono />
      <Box x={552} y={228} w={196} h={36} lines={['命令插件', 'gwb-commands']} mono />
      <Box x={552} y={276} w={196} h={100} lines={['任何插件', '数据 · 设置 · 说明书', '日志插件 …']} />

      <GroupLabel x={222} y={566} name="安装包" where="apps/launcher · installer/" />
      <Box x={222} y={572} w={288} h={40} lines={['启动器', '安装包里只有它与 Electron']} tone="a" />

      <GroupLabel x={552} y={566} name="cordis" where="home 根上只有一份" />
      <Box x={552} y={574} w={196} h={28} lines={['内核、loader、插件共用']} />

      <Box x={600} y={630} w={150} h={36} lines={['外部工具', 'devkit · 装机的 agent']} />

      <GroupLabel x={32} y={720} name="home" where="磁盘上的目录" />
      <Box x={32} y={730} w={120} h={32} lines={['package.json']} />
      <Box x={162} y={730} w={100} h={32} lines={['cordis.yml']} />
      <Box x={272} y={726} w={220} h={40} lines={['node_modules/', '内核包 · cordis · 插件']} />
      <Box x={502} y={730} w={90} h={32} lines={['gwb.log']} />
      <Box x={620} y={726} w={120} h={36} lines={['runtime.json']} />

      <Badge x={527} y={150} n={1} />
      <Badge x={531} y={294} n={2} />
      <Badge x={200} y={270} n={3} />
      <Badge x={375} y={84} n={4} />
      <Badge x={200} y={442} n={5} />
      <Badge x={531} y={198} n={6} />
      <Badge x={675} y={696} n={7} byConvention />
      <Badge x={531} y={342} n={8} />
      <Badge x={470} y={533} n={9} byConvention />
      <Badge x={531} y={246} n={10} />

      <Note x={20} y={798}>虚线框按模块所在的位置分组；连线停在框边上表示接这一组里的每一个模块</Note>
      <Note x={20} y={816}>实线接缝有代码接口，点线接缝只靠约定；灰色箭头是人与 AI 的入口，不算接缝</Note>
      <Note x={20} y={834}>运行时内核包、cordis 与插件都装在 home 的 node_modules 里；启动器按接缝 9 从那里加载内核</Note>
    </svg>
  )
}
