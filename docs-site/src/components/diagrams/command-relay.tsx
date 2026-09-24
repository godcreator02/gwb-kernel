/**
 * 命令转交：上面一行是命令从页面经内核应用交给命令插件，回执原路返回；下面是内核应用直接回失败回执的两种情况。
 * 两条竖虚线是接缝 3（页面只有 window.gwb）与接缝 10（内核应用只调用 gwbCommands.run）。
 */

import { Arrow, Box, Note, SeamLine } from './parts'

export function CommandRelay() {
  return (
    <svg viewBox="0 0 760 266" role="img" aria-label="页面发来的命令经内核应用交给命令插件，没有命令插件时内核应用直接回失败回执">
      <Box x={10} y={34} w={140} h={58} lines={['页面里的代码', "gwb.command('x.ping')"]} mono />
      <Box x={180} y={34} w={120} h={58} lines={['gwb:command', 'IPC 通道']} mono />
      <Box x={330} y={34} w={140} h={58} lines={['内核应用', '读取 ctx.gwbCommands']} />
      <Box x={510} y={34} w={115} h={58} lines={['命令插件', 'gwbCommands.run']} tone="a" mono />
      <Box x={645} y={34} w={105} h={58} lines={['登记了', 'x.ping 的插件']} />
      <Arrow from={[150, 63]} to={[180, 63]} />
      <Arrow from={[300, 63]} to={[330, 63]} />
      <Arrow from={[470, 63]} to={[510, 63]} />
      <Arrow from={[625, 63]} to={[645, 63]} />

      <SeamLine x1={165} y1={24} x2={165} y2={104} label="接缝 3：页面只有 window.gwb" labelX={10} labelY={16} anchor="start" />
      <SeamLine x1={490} y1={24} x2={490} y2={104} label="接缝 10：内核应用只调用 run，不认识命令名" labelX={494} labelY={16} anchor="start" />

      <Note x={750} y={120} anchor="end" size={11}>
        {'回执 { ok, data, error } 原路返回页面'}
      </Note>
      <Note x={750} y={136} anchor="end" size={11}>
        命令不存在、处理函数抛错，命令插件也收成 ok: false
      </Note>

      <Arrow from={[400, 92]} to={[400, 152]} />
      <Box x={300} y={152} w={200} h={62} lines={['内核应用直接回 ok: false', '命令名不是字符串', '或 ctx.gwbCommands 不存在']} />
      <Arrow from={[300, 183]} to={[150, 183]} />
      <Box x={10} y={156} w={140} h={54} lines={['页面收到', '{ ok: false, error }']} mono />
      <Note x={515} y={170} size={11}>
        gwbCommands 不存在，是因为
      </Note>
      <Note x={515} y={186} size={11}>
        home 里没装命令插件，
      </Note>
      <Note x={515} y={202} size={11}>
        或它没加载成功、已停用
      </Note>

      <Note x={380} y={252} anchor="middle" size={11}>
        命令插件是 cordis.yml 里的普通插件；换成别的插件，只要它提供同名服务、run 的形状不变
      </Note>
    </svg>
  )
}
