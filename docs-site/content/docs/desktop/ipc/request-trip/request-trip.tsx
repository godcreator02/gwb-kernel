/**
 * 「一条请求从页面到插件再回来」：三条泳道从上到下是页面主世界、preload、主进程；每一步亮起这一步参与的方块、画出这一步走过的箭头
 * （去程实线、回程虚线），下面给出这一步对应的源码。讲解文字与源码在 request-trip.data.mjs。
 */
import type { JSX } from 'react';
import { Stepper } from '@godcreator/explainer/site';
import { CodeBlock, Lanes } from '../../../_shared/desktop-lanes/lanes';
import type { LaneActor, LaneBand, LaneFlow } from '../../../_shared/desktop-lanes/lanes';
import { actors, steps } from './request-trip.data.mjs';

const VIEW = { w: 780, h: 340 };

const BANDS: LaneBand[] = [
  { label: '页面（主世界）', y: 8, h: 92 },
  { label: 'preload（隔离世界）', y: 112, h: 92 },
  { label: '主进程', y: 216, h: 116 },
];

const BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  client: { x: 40, y: 34, w: 210, h: 54 },
  gwb: { x: 40, y: 138, w: 210, h: 54 },
  ipc: { x: 40, y: 252, w: 200, h: 56 },
  requests: { x: 290, y: 252, w: 180, h: 56 },
  commands: { x: 560, y: 252, w: 196, h: 56 },
};

const FLOWS: LaneFlow[] = [
  { id: 'register', points: [[560, 266], [470, 266]], label: 'handleRequest', labelAt: [515, 246] },
  { id: 'call', points: [[120, 88], [120, 138]], label: "request('commands.run', { name, args })", labelAt: [430, 118] },
  { id: 'invoke', points: [[120, 192], [120, 252]], label: "invoke('gwb:request', channel, payload)", labelAt: [430, 226] },
  { id: 'dispatch', points: [[240, 280], [290, 280]] },
  { id: 'handler', points: [[470, 294], [560, 294]], label: 'handler(payload)', labelAt: [515, 324] },
  { id: 'return', points: [[560, 294], [470, 294]], label: '{ ok, data }', labelAt: [515, 324], back: true },
  { id: 'reply', points: [[290, 294], [240, 294]], back: true },
  { id: 'replyUp', points: [[180, 252], [180, 192]], label: '{ available, value? }', labelAt: [430, 226], back: true },
  { id: 'unwrap', points: [[180, 138], [180, 88]], label: '回执 value', labelAt: [430, 118], back: true },
  { id: 'reject', points: [[180, 138], [180, 88]], label: 'Error: GWB_REQUEST_UNAVAILABLE: commands.run', labelAt: [430, 118], back: true },
];

function placed(actor: (typeof actors)[number]): LaneActor {
  const box = BOX[actor.id];
  if (box === undefined) throw new Error(`请求往返图的布局表里没有参与者「${actor.id}」`);
  return { ...actor, ...box };
}

const ACTORS = actors.map(placed);

export function RequestTripSteps(): JSX.Element {
  return (
    <div className="not-prose">
      <Stepper steps={steps} label="一条请求从页面到插件再回来" interval={7000}>
        {(step) => (
          <>
            <Lanes view={VIEW} bands={BANDS} actors={ACTORS} flows={FLOWS} lit={step.lit} shown={step.shown} marks={step.marks} label={step.title} />
            <CodeBlock code={step.code} role={step.code.file.endsWith('preload.cjs') ? 'violet' : 'blue'} />
          </>
        )}
      </Stepper>
    </div>
  );
}
