/**
 * home 与插件管理的分界：左边是 plugin-manager 用到内核的两样东西，右边是内核里对应的两样，
 * 下面是 home 里的三个文件。只画两边交换什么，不画安装、升级的步骤（那两段在插件管理的功能页各有一张图）。
 */

import { Arrow, Box, BORDER, FG, MUTED, Note, SeamLine } from './parts'

export function PluginHome() {
  return (
    <svg viewBox="0 0 760 330" role="img" aria-label="plugin-manager 与内核之间交换什么">
      <Note x={22} y={26} size={12} color={FG} weight={600}>
        plugin-manager（内核内置的插件，源码在 plugins/）
      </Note>
      <rect x={14} y={36} width={246} height={152} rx={10} fill="none" stroke={BORDER} />
      <Box x={26} y={56} w={222} h={50} lines={['EntryTreeLike', '从自己条目所在层取条目树']} />
      <Box x={26} y={124} w={222} h={50} lines={['applyToHome', '唯一运行 pnpm 的入口，串行排队']} />

      <Note x={508} y={26} size={12} color={FG} weight={600}>
        内核
      </Note>
      <rect x={500} y={36} width={246} height={100} rx={10} fill="none" stroke={BORDER} />
      <Box x={512} y={52} w={106} h={68} lines={['loader + include', '条目树的结构', '读写 cordis.yml']} />
      <Box x={628} y={52} w={106} h={68} lines={['按真实路径解析', '包名 →', '带版本号的目录']} />

      <SeamLine x1={380} y1={40} x2={380} y2={186} label="接缝" labelX={386} labelY={184} anchor="start" />
      <Arrow from={[248, 81]} to={[512, 81]} label="create / update / remove / resolve" />

      <Note x={22} y={216} size={12} color={FG} weight={600}>
        home（磁盘上的目录）
      </Note>
      <rect x={14} y={224} width={732} height={70} rx={10} fill="none" stroke={BORDER} />
      <Box x={26} y={234} w={222} h={50} lines={['package.json + node_modules/', 'pnpm 一起改']} />
      <Box x={512} y={234} w={106} h={50} lines={['cordis.yml', '条目']} />
      <Box x={628} y={234} w={106} h={50} lines={['node_modules/', '按真实路径读']} />

      <Arrow from={[200, 174]} to={[200, 234]} label="pnpm add / remove" />
      <Arrow from={[565, 120]} to={[565, 234]} label="写回并当场加载" />
      <Arrow from={[681, 120]} to={[681, 234]} label="import 时解析" />

      <Note x={270} y={256} size={11} color={MUTED}>
        plugin-manager 只经这两条路改 home：
      </Note>
      <Note x={270} y={272} size={11} color={MUTED}>
        包经 pnpm，条目经 loader 的条目树
      </Note>
      <Note x={380} y={318} anchor="middle" size={11.5} color={MUTED}>
        条目树的结构、home 的布局、解析规则都由内核决定；plugin-manager 内置在内核里，测试和内核一起跑
      </Note>
    </svg>
  )
}
