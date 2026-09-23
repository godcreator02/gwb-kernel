/**
 * plugin-manager 的源码分层：顶上是组装一切的 index.ts，中间是不读磁盘的纯逻辑文件，
 * 下面左边是读磁盘、启动进程的两个文件，右边是插件管理外面的东西。
 */

import { Arrow, Box, BORDER, FG, MUTED, Note } from './parts'

const PURE: { file: string; what: string }[] = [
  { file: 'tree.ts', what: '取条目树' },
  { file: 'inventory.ts', what: '包与条目对照' },
  { file: 'ids.ts', what: 'id 规则与选 id' },
  { file: 'uninstall.ts', what: '卸载删哪些条目' },
  { file: 'outdated.ts', what: '读 outdated' },
  { file: 'update-all.ts', what: '热升级的计划' },
  { file: 'remount.ts', what: '停用再启用' },
  { file: 'pnpm-path.ts', what: 'pnpm 启动参数' },
  { file: 'busy.ts', what: 'BUSY 互斥' },
  { file: 'vocab.ts', what: '取内核服务' },
]

export function PmModules() {
  return (
    <svg viewBox="0 0 760 350" role="img" aria-label="plugin-manager 的源码分层">
      <Box x={260} y={14} w={240} h={48} lines={['index.ts', '12 条命令，按顺序调用各块']} tone="a" />
      <Arrow from={[380, 62]} to={[380, 96]} label="import" />

      <Note x={22} y={90} size={12} color={FG} weight={600}>
        纯逻辑：不读磁盘、不启动进程，单元测试传入构造的数据
      </Note>
      <rect x={14} y={98} width={732} height={124} rx={10} fill="none" stroke={BORDER} />
      {PURE.map((one, index) => (
        <Box
          key={one.file}
          x={24 + (index % 6) * 120}
          y={index < 6 ? 110 : 164}
          w={112}
          h={46}
          lines={[one.file, one.what]}
        />
      ))}

      <Note x={22} y={244} size={12} color={FG} weight={600}>
        读磁盘、启动进程
      </Note>
      <rect x={14} y={252} width={352} height={70} rx={10} fill="none" stroke={BORDER} />
      <Box x={26} y={264} w={160} h={46} lines={['home.ts', '读 home 与已装包的清单']} />
      <Box x={196} y={264} w={160} h={46} lines={['pnpm.ts', '找 pnpm、启动进程']} />

      <Note x={388} y={244} size={12} color={FG} weight={600}>
        插件管理外面
      </Note>
      <rect x={380} y={252} width={366} height={70} rx={10} fill="none" stroke={BORDER} />
      <Box x={392} y={264} w={110} h={46} lines={['home 目录', 'package.json 等']} />
      <Box x={512} y={264} w={110} h={46} lines={['条目树', 'loader 根层上']} />
      <Box x={632} y={264} w={104} h={46} lines={['内置命令插件', 'data 等 3 个可选']} />
      <Arrow from={[356, 287]} to={[392, 287]} />

      <Note x={380} y={342} anchor="middle" size={11.5} color={MUTED}>
        index.ts 依赖其余所有文件；构建产物里除了 node 内置模块，没有别的包名 import
      </Note>
    </svg>
  )
}
