/**
 * 命令与事件：上面一行是命令从页面到插件、回执原路返回；下面一行是事件从插件推到页面。
 * 两条竖虚线是两道分界：页面与主进程之间只有 window.gwb；内核与命令总线之间内核不认识命令名。
 */

import { Arrow, Box, Note, SeamLine } from './parts'

export function CommandRelay() {
  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="命令从页面转交给命令总线，事件从插件推给页面">
      <Note x={16} y={20} size={12} color="var(--color-fd-foreground)" weight={600}>
        命令
      </Note>
      <Box x={10} y={30} w={140} h={58} lines={['页面里的代码', "gwb.command('x.ping')"]} mono />
      <Box x={180} y={30} w={130} h={58} lines={['gwb:command', 'IPC 通道']} mono />
      <Box x={340} y={30} w={130} h={58} lines={['内核', '原样转交']} />
      <Box x={500} y={30} w={115} h={58} lines={['gwbCommands', '命令总线插件']} tone="a" />
      <Box x={640} y={30} w={110} h={58} lines={['注册了', 'x.ping 的插件']} />
      <Arrow from={[150, 52]} to={[180, 52]} />
      <Arrow from={[310, 52]} to={[340, 52]} />
      <Arrow from={[470, 52]} to={[500, 52]} />
      <Arrow from={[615, 52]} to={[640, 52]} />
      <Note x={400} y={114} anchor="middle" size={11}>
        回执 {'{ ok, data, error }'} 原路返回；没有提供 gwbCommands 的插件时，内核直接回 ok: false
      </Note>

      <Note x={16} y={150} size={12} color="var(--color-fd-foreground)" weight={600}>
        事件
      </Note>
      <Box x={500} y={160} w={250} h={58} lines={['任何插件', 'ctx.gwbKernel.emit(payload)']} mono />
      <Box x={340} y={160} w={130} h={58} lines={['内核', '原样推送']} />
      <Box x={180} y={160} w={130} h={58} lines={['gwb:event', '只推送、不保留']} mono />
      <Box x={10} y={160} w={140} h={58} lines={['页面里的代码', 'gwb.on(cb)']} mono />
      <Arrow from={[500, 189]} to={[470, 189]} />
      <Arrow from={[340, 189]} to={[310, 189]} />
      <Arrow from={[180, 189]} to={[150, 189]} />

      <SeamLine x1={165} y1={14} x2={165} y2={236} label="页面这边只有 window.gwb 的三个函数" labelX={10} labelY={250} anchor="start" />
      <SeamLine x1={485} y1={24} x2={485} y2={94} label="内核不认识任何命令名" labelX={492} labelY={18} anchor="start" />
      <Note x={380} y={290} anchor="middle" size={11}>
        换命令总线：任何插件提供 gwbCommands 服务即可；内核只认这个服务名
      </Note>
    </svg>
  )
}
