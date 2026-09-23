/**
 * 插件管理用的 pnpm 由内核交来：打包运行时是安装包资源目录里那个，从源码运行时是内核仓依赖里那个；
 * 内核经 config 把路径交给插件管理，插件管理直接启动它；文件不在就报错。
 */

import { Arrow, Box, MUTED, Note } from './parts'

export function PmPnpmLookup() {
  return (
    <svg viewBox="0 0 760 214" role="img" aria-label="内核把 pnpm 的路径交给插件管理">
      <Box x={14} y={20} w={230} h={52} lines={['安装包运行', 'resources/pnpm/pnpm.exe']} mono />
      <Box x={14} y={92} w={230} h={52} lines={['从源码运行', 'apps/desktop 依赖的 @pnpm/exe.win32-x64']} />
      <Box x={290} y={52} w={170} h={60} lines={['内核 main.ts', '加载插件管理时经 config 交出路径']} />
      <Arrow from={[244, 46]} to={[290, 72]} />
      <Arrow from={[244, 118]} to={[290, 94]} />
      <Box x={510} y={24} w={236} h={56} lines={['插件管理', '直接启动 pnpm.exe，工作目录是 home']} tone="a" />
      <Arrow from={[460, 76]} to={[510, 56]} label="{ pnpm }" />
      <Box x={510} y={120} w={236} h={48} lines={['文件不在', '报错：重装工作台']} tone="b" />
      <Arrow from={[628, 80]} to={[628, 120]} dashed />
      <Note x={14} y={194}>
        机器上装没装 pnpm、装的哪个版本，都和插件管理无关；home 里也没有 pnpm
      </Note>
    </svg>
  )
}
