'use client'

/**
 * K5：扩展点服务继承 Service 时，注册的清理登记在调用方的上下文里，调用方卸载时自动撤销。
 * 最后一步是对照：用 ctx.provide 提供的普通对象认不出调用方，调用方忘了包 ctx.effect，注册就留在表里。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

interface Step {
  title: string
  detail: string
  cleanup: string
  callerGone: boolean
  row: 'live' | 'gone' | 'stale'
  plainObject: boolean
}

const STEPS: Step[] = [
  { title: '第 1 步：插件 A 调用 register', detail: 'A 调用 ctx.gwbExample.register(item)。服务方法里的 this.ctx 是 A 的上下文，不是服务自己的。', cleanup: '（还没有）', callerGone: false, row: 'live', plainObject: false },
  { title: '第 2 步：注销函数登记到 A 的上下文', detail: '服务执行 this.ctx.effect(() => unregister)：这条清理记在 A 身上。', cleanup: 'unregister(item)', callerGone: false, row: 'live', plainObject: false },
  { title: '第 3 步：A 卸载', detail: 'cordis 执行 A 上下文里登记的全部清理，item 从表里删掉。A 自己一行清理代码都不用写。', cleanup: 'unregister(item) 已执行', callerGone: true, row: 'gone', plainObject: false },
  { title: '对照：用 ctx.provide 提供普通对象', detail: '服务拿不到调用方的上下文，只能把注销函数还给 A。A 忘了包 ctx.effect，卸载之后 item 还留在表里。', cleanup: '（没有登记）', callerGone: true, row: 'stale', plainObject: true },
]

export function CallerCleanup() {
  const state = useSteps(STEPS.length, 3000)
  const current = STEPS[state.step]!

  return (
    <>
      <svg viewBox="0 0 760 300" role="img" aria-label="注册随调用方卸载自动撤销">
        <Box x={16} y={30} w={220} h={52} lines={['插件 A', 'register(item)']} dim={current.callerGone} dashed={current.callerGone} />
        <Note x={24} y={112} size={11.5} color={FG} weight={600}>
          A 的上下文里登记的清理
        </Note>
        <rect x={16} y={120} width={220} height={40} rx={6} fill="none" stroke={BORDER} />
        <text x={126} y={144} textAnchor="middle" fontSize={11.5} fontFamily={MONO} fill={state.step === 1 ? 'var(--diagram-a)' : MUTED}>
          {current.cleanup}
        </text>

        <Arrow from={[236, 56]} to={[290, 56]} />
        <Box x={290} y={30} w={200} h={52} lines={current.plainObject ? ['ctx.provide 的普通对象', '认不出是谁在注册'] : ['gwbExample 服务', '继承 Service']} tone={current.plainObject ? 'b' : 'a'} />
        {!current.plainObject && state.step === 1 && <Arrow from={[330, 82]} to={[200, 120]} tone="a" label="this.ctx.effect" />}
        <Arrow from={[490, 56]} to={[540, 56]} />

        <Note x={548} y={22} size={12} color={FG} weight={600}>
          注册表
        </Note>
        <rect x={540} y={30} width={204} height={96} rx={8} fill="none" stroke={BORDER} />
        {current.row !== 'gone' && (
          <g>
            <rect x={552} y={44} width={180} height={26} rx={5} fill={current.row === 'stale' ? 'var(--diagram-b-soft)' : 'none'} stroke={current.row === 'stale' ? 'var(--diagram-b)' : MUTED} />
            <text x={564} y={58} dominantBaseline="middle" fontSize={12} fontFamily={MONO} fill={FG}>
              item
            </text>
            <text x={722} y={58} dominantBaseline="middle" textAnchor="end" fontSize={10.5} fill={current.row === 'stale' ? 'var(--diagram-b)' : MUTED}>
              {current.row === 'stale' ? '注册方已不在' : '来自 A'}
            </text>
          </g>
        )}
        {current.row === 'gone' && (
          <text x={642} y={60} textAnchor="middle" fontSize={11.5} fill={MUTED}>
            （空）
          </text>
        )}

        <StepCaption x={20} y={214} w={720} title={current.title} detail={current.detail} />
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
