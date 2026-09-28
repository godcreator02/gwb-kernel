'use client';
/**
 * 「一次启动与一条命令」：六条竖线是启动器、内核主进程、cordis、插件、页面、home 里的文件，
 * 每一步画出这一步里依次发生的消息；实线带首页接缝图的编号，虚线是内核包内部的 IPC。讲解文字与消息在 boot-and-request.data.mjs。
 */
import type { JSX } from 'react';
import { Stepper } from '@godcreator/docfirst-explainer';
import { lanes, steps } from './boot-and-request.data.mjs';
import './boot-and-request.css';

const VIEW_W = 780;
const HEAD_Y = 8;
const HEAD_H = 44;
const FIRST_ROW_Y = 92;
const ROW_GAP = 42;
const LANE_GAP = VIEW_W / lanes.length;
const MOST_MESSAGES = Math.max(...steps.map((step) => step.messages.length));
const VIEW_H = FIRST_ROW_Y + (MOST_MESSAGES - 1) * ROW_GAP + 28;

function laneX(id: string): number {
  const index = lanes.findIndex((lane) => lane.id === id);
  if (index < 0) throw new Error(`「一次启动与一条命令」里没有竖线「${id}」`);
  return LANE_GAP * index + LANE_GAP / 2;
}

type Message = (typeof steps)[number]['messages'][number];

function MessageArrow({ message, y }: { message: Message; y: number }): JSX.Element {
  const x1 = laneX(message.from);
  const x2 = laneX(message.to);
  const direction = Math.sign(x2 - x1);
  const tip = x2 - direction * 5;
  const head = `${tip},${y} ${tip - direction * 8},${y - 4} ${tip - direction * 8},${y + 4}`;
  const badgeX = x1 + direction * 18;
  return (
    <g className="br-msg" data-seam={message.seam === null ? 'none' : 'seam'}>
      <line x1={x1} y1={y} x2={tip - direction * 6} y2={y} />
      <polygon points={head} />
      <text className="br-label" x={(x1 + x2) / 2} y={y - 8} textAnchor="middle">
        {message.label}
      </text>
      {message.seam === null ? null : (
        <g className="br-badge">
          <circle cx={badgeX} cy={y} r={8.5} />
          <text x={badgeX} y={y} textAnchor="middle" dominantBaseline="central">
            {message.seam}
          </text>
        </g>
      )}
    </g>
  );
}

function SequenceFrame({ step }: { step: (typeof steps)[number] }): JSX.Element {
  const active = new Set(step.messages.flatMap((m) => [m.from, m.to]));
  return (
    <div className="br-scroll">
      <svg className="br-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={step.title} style={{ minWidth: 640 }}>
        {lanes.map((lane) => {
          const x = laneX(lane.id);
          return (
            <g key={lane.id} className="br-lane" data-role={lane.role} data-lit={active.has(lane.id)}>
              <line className="br-life" x1={x} y1={HEAD_Y + HEAD_H} x2={x} y2={VIEW_H - 6} />
              <rect x={x - LANE_GAP / 2 + 6} y={HEAD_Y} width={LANE_GAP - 12} height={HEAD_H} rx={9} />
              <text className="br-name" x={x} y={HEAD_Y + 19} textAnchor="middle">
                {lane.name}
              </text>
              <text className="br-sub" x={x} y={HEAD_Y + 35} textAnchor="middle">
                {lane.sub}
              </text>
            </g>
          );
        })}
        {step.messages.map((message, index) => (
          <MessageArrow key={`${step.title}-${index}`} message={message} y={FIRST_ROW_Y + index * ROW_GAP} />
        ))}
      </svg>
      <p className="br-legend">带编号的实线走首页接缝图上的那条接缝；虚线两端都在内核包里。</p>
    </div>
  );
}

export function BootAndRequestSteps(): JSX.Element {
  return (
    <div className="not-prose">
      <Stepper steps={steps} label="一次启动与一条命令" interval={7000}>
        {(step) => <SequenceFrame step={step} />}
      </Stepper>
    </div>
  );
}
