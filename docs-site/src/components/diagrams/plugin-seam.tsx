/**
 * 插件与内核这条接缝：上面是内核（含两个内置插件）与它提供的 gwbKernel、gwbCommands，虚线是分界线，下面是插件；
 * 右边是换插件的地方——cordis.yml 的条目与 home 的 node_modules。
 */

import { Arrow, Box, MUTED, Note } from './parts'

export function PluginSeam() {
  return (
    <svg viewBox="0 0 760 350" role="img" aria-label="插件与内核之间交换什么、在哪里换插件">
      <Box x={120} y={12} w={420} h={52} lines={['内核（含内置的命令插件、插件管理）', '选定 home · 创建 cordis 实例 · 注册 loader 与 include']} />
      <line x1={330} y1={64} x2={330} y2={92} stroke="var(--color-fd-border)" strokeWidth={1.5} />
      <Box x={150} y={92} w={360} h={50} lines={['ctx.gwbKernel · ctx.gwbCommands', 'dataDir · version · emit · setShell · register · run']} tone="a" />

      <line x1={10} y1={172} x2={560} y2={172} stroke={MUTED} strokeWidth={1} strokeDasharray="6 5" />
      <Note x={14} y={164} size={11}>
        分界线：上面不认识 cordis.yml 里任何插件的名字
      </Note>
      <Note x={14} y={190} size={11}>
        下面只从 ctx 拿内核的东西
      </Note>

      <Arrow from={[330, 142]} to={[95, 230]} />
      <Arrow from={[330, 142]} to={[275, 230]} />
      <Arrow from={[330, 142]} to={[455, 230]} />
      <Box x={20} y={230} w={150} h={62} lines={['mcp', '经 gwbCommands 调命令']} />
      <Box x={200} y={230} w={150} h={62} lines={['shell', '调用 setShell']} />
      <Box x={380} y={230} w={150} h={62} lines={['任何一个插件', 'apply(ctx) 或 Service 类']} />
      <Note x={275} y={320} anchor="middle" size={11}>
        每个插件是 home 里的一个 npm 包；插件之间通过服务和命令交互，不经过内核
      </Note>

      <Note x={588} y={222} size={12} color="var(--color-fd-foreground)" weight={600}>
        在哪里换插件
      </Note>
      <Box x={582} y={232} w={166} h={46} lines={['cordis.yml', '一条条目写一个包名']} tone="b" mono />
      <Box x={582} y={288} w={166} h={46} lines={['node_modules/', '按真实路径找到包']} tone="b" mono />
      <line x1={532} y1={260} x2={582} y2={260} stroke="var(--color-fd-border)" strokeWidth={1} strokeDasharray="3 3" />
    </svg>
  )
}
