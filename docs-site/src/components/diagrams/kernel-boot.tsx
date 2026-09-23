'use client'

/**
 * 一次启动：左边是 home 里的文件，中间是主进程（内核与 cordis 实例），右边是页面。
 * 第 0 步是全貌，之后每一步把这一步碰到的东西点亮；cordis.yml 里的插件在第 5 步出现，
 * 页面的 #root 从空、只读状态页到外壳。
 */

import { Arrow, Box, BORDER, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

type Part = 'package' | 'yml' | 'modules' | 'log' | 'runtime' | 'kernel' | 'cordis' | 'gwbKernel' | 'loader' | 'plugins' | 'shell' | 'page'

const STEPS: { title: string; detail: string; lit: Part[]; root: string }[] = [
  { title: '全貌', detail: '两个进程：主进程里是内核和 cordis 实例，插件都运行在 cordis 里；页面是唯一的窗口。home 是磁盘上的一个目录。', lit: [], root: '' },
  { title: '第 1 步：选定 home', detail: '按 GWB_HOME 选定目录；缺 package.json 或 cordis.yml 就补一份最小的，已有的不动。', lit: ['package', 'yml', 'kernel'], root: '' },
  { title: '第 2 步：日志、单实例锁、运行记录', detail: '打开 gwb.log；同一个 home 已有实例在运行就退出；把 pid、版本写进 runtime.json。', lit: ['log', 'runtime', 'kernel'], root: '' },
  { title: '第 3 步：创建 cordis 实例', detail: '根上下文指向 home，并提供 gwbKernel——早于任何插件。', lit: ['cordis', 'gwbKernel'], root: '' },
  { title: '第 4 步：创建窗口', detail: '页面加载入口 index.html。这时还没有外壳，页面显示只读状态页。', lit: ['page'], root: '只读状态页' },
  { title: '第 5 步：加载 cordis.yml 里的插件', detail: '注册 loader 与 include；include 读 cordis.yml，loader 按条目从 home 的 node_modules 按真实路径找到包并加载。命令插件、插件管理也是这样加载的。', lit: ['loader', 'yml', 'modules', 'plugins', 'shell'], root: '只读状态页' },
  { title: '第 6 步：页面交给外壳', detail: '外壳插件调用 setShell；页面注入 importmap、import 外壳模块、把 #root 交给它。', lit: ['shell', 'gwbKernel', 'page'], root: '外壳' },
]

export function KernelBoot() {
  const state = useSteps(STEPS.length, 2800)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const pluginsShown = state.step === 0 || state.step >= 5
  const rootText = current.root

  return (
    <>
      <svg viewBox="0 0 760 400" role="img" aria-label="内核一次启动的六步">
        {/* home */}
        <Note x={20} y={22} size={12} color="var(--color-fd-foreground)" weight={600}>
          home（磁盘上的目录）
        </Note>
        <rect x={14} y={32} width={176} height={276} rx={10} fill="none" stroke={BORDER} />
        <Box x={26} y={46} w={152} h={38} lines={['package.json', '列出装了哪些包']} tone={lit('package')} />
        <Box x={26} y={92} w={152} h={38} lines={['cordis.yml', '要加载的条目']} tone={lit('yml')} />
        <Box x={26} y={138} w={152} h={38} lines={['node_modules/', '插件本体']} tone={lit('modules')} />
        <Box x={26} y={184} w={152} h={38} lines={['gwb.log', '日志']} tone={lit('log')} />
        <Box x={26} y={230} w={152} h={38} lines={['runtime.json', '本次运行的记录']} tone={lit('runtime')} />
        <Note x={102} y={292} anchor="middle" size={10.5}>
          各插件的数据也在这里
        </Note>

        {/* 主进程 */}
        <Note x={216} y={22} size={12} color="var(--color-fd-foreground)" weight={600}>
          主进程（Electron）
        </Note>
        <rect x={208} y={32} width={336} height={276} rx={10} fill="none" stroke={BORDER} />
        <Box x={222} y={46} w={308} h={44} lines={['内核 main.ts', '选定 home · 日志 · 单实例锁 · 窗口 · IPC']} tone={lit('kernel')} />
        <rect x={222} y={102} width={308} height={194} rx={8} fill="none" stroke={current.lit.includes('cordis') ? 'var(--diagram-a)' : MUTED} strokeWidth={1.2} />
        <Note x={234} y={120} size={12} color="var(--color-fd-foreground)" weight={600}>
          cordis 实例
        </Note>
        <Box x={234} y={130} w={136} h={44} lines={['gwbKernel', '根上下文上的服务']} tone={lit('gwbKernel')} />
        <Box x={382} y={130} w={136} h={44} lines={['loader + include', '读 cordis.yml']} tone={lit('loader')} />
        <Box x={234} y={190} w={136} h={44} lines={['命令插件', '插件管理 · …']} tone={lit('plugins')} dim={!pluginsShown} dashed={!pluginsShown} />
        <Box x={382} y={190} w={64} h={44} lines={['shell', '外壳']} tone={lit('shell')} dim={!pluginsShown} dashed={!pluginsShown} />
        <Box x={454} y={190} w={64} h={44} lines={['其他插件', '…']} tone={lit('plugins')} dim={!pluginsShown} dashed={!pluginsShown} />
        <Note x={376} y={262} anchor="middle" size={10.5}>
          cordis.yml 里的插件也运行在这里，内核不认识它们的名字
        </Note>

        {/* 页面 */}
        <Note x={570} y={22} size={12} color="var(--color-fd-foreground)" weight={600}>
          页面（唯一的窗口）
        </Note>
        <rect x={562} y={32} width={184} height={276} rx={10} fill="none" stroke={current.lit.includes('page') ? 'var(--diagram-a)' : BORDER} />
        <Box x={576} y={46} w={156} h={44} lines={['index.html', '入口']} />
        <Box x={576} y={100} w={156} h={44} lines={['window.gwb', 'command · on · onShell']} />
        <rect x={576} y={156} width={156} height={140} rx={8} fill="none" stroke={MUTED} strokeDasharray="4 3" />
        <Note x={588} y={174} size={11}>
          #root
        </Note>
        <text x={654} y={232} textAnchor="middle" fontSize={rootText === '' ? 11 : 13} fontWeight={600} fill={rootText === '外壳' ? 'var(--diagram-a)' : rootText === '' ? MUTED : 'var(--color-fd-foreground)'}>
          {rootText === '' ? '（空）' : rootText}
        </text>

        {/* 两个进程之间 */}
        <Arrow from={[562, 112]} to={[544, 112]} />
        <Arrow from={[544, 128]} to={[562, 128]} />

        <StepCaption x={20} y={336} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
