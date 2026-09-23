/**
 * 找 pnpm 的顺序：填了设置项就只按设置项找，找不到直接报错；没填才按 PATH 顺序逐个目录找，
 * 最后都落到本机平台的那份原生二进制上；每一处都不行时报错并列出原因。
 */

import { Arrow, Box, MUTED, Note } from './parts'

export function PmPnpmLookup() {
  return (
    <svg viewBox="0 0 760 250" role="img" aria-label="找 pnpm 的顺序">
      <Box x={14} y={24} w={200} h={56} lines={['设置项 pnpm-path', '填了吗？']} />
      <Box x={264} y={24} w={230} h={56} lines={['按设置项找', '可执行文件 / 垫片 / 目录 / 包目录']} />
      <Box x={530} y={24} w={216} h={56} lines={['找到就用它', '找不到直接报错，不回退 PATH']} tone="a" />
      <Arrow from={[214, 52]} to={[264, 52]} label="填了" />
      <Arrow from={[494, 52]} to={[530, 52]} />

      <Box x={14} y={120} w={200} h={56} lines={['按 PATH 顺序', '逐个目录找']} />
      <Box x={264} y={120} w={230} h={56} lines={['pnpm.exe 直接用', 'pnpm.cmd → npm 全局安装的布局']} />
      <Box x={530} y={120} w={216} h={56} lines={['本机的原生二进制', '@pnpm/exe.<平台>-<架构>']} tone="a" />
      <Arrow from={[114, 80]} to={[114, 120]} label="没填" />
      <Arrow from={[214, 148]} to={[264, 148]} />
      <Arrow from={[494, 148]} to={[530, 148]} />

      <Box x={264} y={200} w={230} h={44} lines={['每一处都不行', '报错，列出每一处的原因']} tone="b" />
      <Arrow from={[379, 176]} to={[379, 200]} />
      <Note x={530} y={226} size={11} color={MUTED}>
        pnpm 包大版本低于 12：明确报错，不试着运行
      </Note>
    </svg>
  )
}
