/**
 * 系统地图：左边是主进程里的几个文件，灰色箭头表示依赖（从 import 的一方指向被 import 的一方）；
 * 右边是页面一侧的两个文件；main.ts 与 preload.cjs 之间的两根强调色箭头表示 IPC 消息的方向，
 * 线上写着走这个方向的通道名。底下是只被 import 类型的词汇表包。
 */

import { Arrow, Box, FG, Note, SeamLine } from './parts'

export function ModuleMap() {
  return (
    <svg viewBox="0 0 760 340" role="img" aria-label="内核的文件、依赖方向与 IPC 通道">
      <Note x={16} y={18} size={12} color={FG} weight={600}>
        主进程
      </Note>
      <Box x={170} y={30} w={230} h={52} lines={['main.ts', '把各部分组装起来；唯一依赖 electron 的文件']} />

      <Arrow from={[230, 82]} to={[75, 140]} />
      <Arrow from={[260, 82]} to={[220, 140]} />
      <Arrow from={[330, 82]} to={[365, 140]} />
      <Arrow from={[370, 82]} to={[490, 140]} />
      <Arrow from={[160, 169]} to={[137, 169]} />

      <Box x={15} y={140} w={120} h={58} lines={['bare-import.ts', '按 home 解析包名']} />
      <Box x={160} y={140} w={120} h={58} lines={['imports.ts', '拼 importmap']} />
      <Box x={305} y={140} w={120} h={58} lines={['entry-state.ts', '条目状态一句话']} />
      <Box x={430} y={140} w={120} h={58} lines={['log-file.ts', '日志文件与轮转']} />
      <Note x={283} y={222} anchor="middle" size={10.5}>
        这四个文件不依赖 electron 与 cordis 实例，各有单元测试
      </Note>

      <SeamLine x1={572} y1={94} x2={572} y2={235} label="" labelX={0} labelY={0} />
      <Note x={590} y={18} size={12} color={FG} weight={600}>
        页面
      </Note>
      <Box x={590} y={30} w={155} h={52} lines={['preload.cjs', '注入 window.gwb']} />
      <Box x={590} y={140} w={155} h={58} lines={['index.html', '注入 importmap · 交出 #root', '没有外壳时显示状态页']} />
      <Arrow from={[400, 48]} to={[590, 48]} tone="a" label="gwb:shell · gwb:event" />
      <Arrow from={[590, 64]} to={[400, 64]} tone="a" label="gwb:command" labelAt="below" />

      <Box x={120} y={250} w={520} h={46} lines={['@godcreator/gwb-plugin-api（词汇表包）', '只有类型：main.ts 和插件都只 import 类型，运行时不存在']} tone="b" dashed />

      <line x1={180} y1={322} x2={210} y2={322} stroke="var(--color-fd-muted-foreground)" strokeWidth={1.2} />
      <Note x={216} y={326} size={10.5}>
        依赖：从 import 的一方指向被 import 的一方
      </Note>
      <line x1={450} y1={322} x2={480} y2={322} stroke="var(--diagram-a)" strokeWidth={1.2} />
      <Note x={486} y={326} size={10.5}>
        IPC 消息的方向，线上是通道名
      </Note>
    </svg>
  )
}
