'use client'

/**
 * 外壳接管页面：左边主进程（外壳插件与内核记着的外壳地址），右边页面（入口与 #root），
 * 中间是这一步的那条消息。五步：订阅、没有外壳、setShell、交出 #root、外壳卸载。
 */

import { Arrow, Box, BORDER, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

interface Step {
  title: string
  detail: string
  message?: { text: string; toPage: boolean }
  shellUrl: string
  shellLit: boolean
  shellGone: boolean
  root: string
}

const STEPS: Step[] = [
  { title: '第 1 步：页面订阅 onShell', detail: '页面加载后订阅 onShell；订阅时发一次 gwb:hello，问当前外壳是谁。', message: { text: 'gwb:hello', toPage: false }, shellUrl: 'null', shellLit: false, shellGone: false, root: '（空）' },
  { title: '第 2 步：还没有外壳', detail: '内核推 gwb:shell：url 是 null，附带 importmap 和只读状态页的数据。页面显示只读状态页。', message: { text: '{ url: null, imports, report }', toPage: true }, shellUrl: 'null', shellLit: false, shellGone: false, root: '只读状态页' },
  { title: '第 3 步：外壳插件调用 setShell(url)', detail: 'shell 插件加载后，把自己页面一侧模块的地址交给内核；内核记下它，再推一次 gwb:shell。', message: { text: '{ url, imports, report }', toPage: true }, shellUrl: '…/client.js', shellLit: true, shellGone: false, root: '只读状态页' },
  { title: '第 4 步：页面交给外壳', detail: '页面先注入 importmap，再 import 这个地址，把 #root 交给它的默认导出，留下它返回的 dispose。', shellUrl: '…/client.js', shellLit: false, shellGone: false, root: '外壳' },
  { title: '第 5 步：外壳插件卸载', detail: 'setShell 返回的撤销函数执行，内核推 url 为 null；页面调用旧外壳的 dispose，回到只读状态页。', message: { text: '{ url: null, … }', toPage: true }, shellUrl: 'null', shellLit: false, shellGone: true, root: '只读状态页' },
]

export function ShellHandover() {
  const state = useSteps(STEPS.length, 3000)
  const current = STEPS[state.step]!
  const message = current.message

  return (
    <>
      <svg viewBox="0 0 760 330" role="img" aria-label="外壳怎么接管页面、卸载后怎么回到只读状态页">
        <Note x={24} y={22} size={12} color="var(--color-fd-foreground)" weight={600}>
          主进程
        </Note>
        <rect x={16} y={30} width={250} height={200} rx={10} fill="none" stroke={BORDER} />
        <Box x={32} y={46} w={218} h={52} lines={['shell 插件', 'setShell(页面一侧模块的地址)']} tone={current.shellLit ? 'a' : undefined} dim={current.shellGone} dashed={current.shellGone} />
        <Box x={32} y={116} w={218} h={52} lines={['内核记着的外壳地址', current.shellUrl]} mono tone={current.shellUrl === 'null' ? undefined : 'a'} />
        <Note x={141} y={200} anchor="middle" size={10.5}>
          后调用 setShell 的替换先调用的
        </Note>

        <Note x={502} y={22} size={12} color="var(--color-fd-foreground)" weight={600}>
          页面
        </Note>
        <rect x={494} y={30} width={250} height={200} rx={10} fill="none" stroke={BORDER} />
        <Box x={510} y={46} w={218} h={44} lines={['index.html', 'onShell 的回调']} />
        <rect x={510} y={104} width={218} height={112} rx={8} fill={current.root === '外壳' ? 'var(--diagram-a-soft)' : 'none'} stroke={current.root === '外壳' ? 'var(--diagram-a)' : MUTED} strokeDasharray={current.root === '外壳' ? undefined : '4 3'} style={{ transition: 'fill 400ms ease' }} />
        <Note x={522} y={122} size={11}>
          #root
        </Note>
        <text x={619} y={168} textAnchor="middle" fontSize={13} fontWeight={600} fill={current.root === '（空）' ? MUTED : 'var(--color-fd-foreground)'}>
          {current.root}
        </text>

        {message !== undefined &&
          (message.toPage ? (
            <Arrow from={[266, 120]} to={[494, 120]} label={message.text} tone="a" />
          ) : (
            <Arrow from={[494, 120]} to={[266, 120]} label={message.text} tone="a" />
          ))}

        <StepCaption x={20} y={266} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
