'use client';
/**
 * 「从双击 gwb-kernel 到内核接手」：上面一行是这个进程此刻的环境变量 GWB_HOME，中间两条横带是安装目录与 home，
 * 带里是参与者方块，方块之间是这一步走过的箭头；下面是这一步对应的源码。讲解文字与源码在 launcher-boot.data.mjs。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill, Stepper } from '@godcreator/docfirst-explainer';
import { actors, bands, steps } from './launcher-boot.data.mjs';
import './launcher-boot.css';

type Point = [number, number];

const VIEW = { w: 760, h: 300 };

const BAND_BOX: Record<string, { y: number; h: number }> = {
  install: { y: 6, h: 128 },
  home: { y: 160, h: 134 },
};

const ACTOR_BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  exe: { x: 24, y: 50, w: 190, h: 60 },
  main: { x: 285, y: 50, w: 190, h: 60 },
  plan: { x: 546, y: 50, w: 190, h: 60 },
  kernelHome: { x: 24, y: 212, w: 190, h: 60 },
  entry: { x: 285, y: 212, w: 190, h: 60 },
  manifest: { x: 546, y: 212, w: 190, h: 60 },
};

const FLOWS: { id: string; points: Point[]; label: string; labelAt: Point }[] = [
  { id: 'run', points: [[214, 80], [285, 80]], label: 'main.js', labelAt: [249, 72] },
  { id: 'homePathFor', points: [[475, 68], [546, 68]], label: 'homePathFor', labelAt: [510, 60] },
  { id: 'kernelEntryFor', points: [[475, 94], [546, 94]], label: 'kernelEntryFor', labelAt: [510, 108] },
  { id: 'read', points: [[641, 110], [641, 212]], label: '读清单', labelAt: [690, 165] },
  { id: 'import', points: [[380, 110], [380, 212]], label: 'import(entryFile)', labelAt: [380, 165] },
  { id: 'rehome', points: [[285, 242], [214, 242]], label: 'GWB_HOME', labelAt: [249, 234] },
];

function boxOf<T>(table: Record<string, T>, id: string, what: string): T {
  const box = table[id];
  if (box === undefined) throw new Error(`启动器讲解图的布局表里没有${what}「${id}」`);
  return box;
}

function arrowHead(from: Point, tip: Point): string {
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const bx = tip[0] - ux * 8;
  const by = tip[1] - uy * 8;
  return `${tip[0]},${tip[1]} ${bx - uy * 4},${by + ux * 4} ${bx + uy * 4},${by - ux * 4}`;
}

function Lanes({ lit, shown, label }: { lit: readonly string[]; shown: readonly string[]; label: string }): JSX.Element {
  const litSet = new Set(lit);
  for (const id of shown) if (!FLOWS.some((flow) => flow.id === id)) throw new Error(`启动器讲解图里没有箭头「${id}」`);
  return (
    <div className="lb-scroll">
      <svg className="lb-svg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" aria-label={label}>
        {bands.map((band) => {
          const box = boxOf(BAND_BOX, band.id, '横带');
          return (
            <g key={band.id} className="lb-band">
              <rect x={4} y={box.y} width={VIEW.w - 8} height={box.h} rx={12} />
              <text x={16} y={box.y + 20}>
                {band.label}
              </text>
            </g>
          );
        })}
        {actors.map((actor) => {
          const box = boxOf(ACTOR_BOX, actor.id, '参与者');
          return (
            <g key={actor.id} className="lb-actor" data-role={actor.role} data-lit={litSet.has(actor.id)}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={10} />
              <text className="lb-name" x={box.x + box.w / 2} y={box.y + box.h / 2 - 5} textAnchor="middle">
                {actor.name}
              </text>
              <text className="lb-sub" x={box.x + box.w / 2} y={box.y + box.h / 2 + 13} textAnchor="middle">
                {actor.sub}
              </text>
            </g>
          );
        })}
        {FLOWS.filter((flow) => shown.includes(flow.id)).map((flow) => {
          const last = flow.points.length - 1;
          const d = flow.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
          return (
            <g key={flow.id} className="lb-flow" data-disk={flow.id === 'read'}>
              <path d={d} />
              <polygon points={arrowHead(flow.points[last - 1]!, flow.points[last]!)} />
              <text x={flow.labelAt[0]} y={flow.labelAt[1]} textAnchor="middle">
                {flow.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LauncherBootSteps(): JSX.Element {
  return (
    <div className="launcher-boot not-prose">
      <Stepper steps={steps} label="从双击 gwb-kernel 到内核接手" interval={6500}>
        {(step) => {
          const end = step.code.start + step.code.lines.length - 1;
          return (
            <>
              <div className="lb-env">
                <Pill role="blue">进程环境</Pill>
                <code>
                  GWB_HOME = <span data-set={step.env !== '（未设）'}>{step.env}</span>
                </code>
              </div>
              <Lanes lit={step.lit} shown={step.shown} label={step.title} />
              <Pane title={step.code.file} role={step.code.file.startsWith('apps/desktop') ? 'slate' : 'blue'} icon="file" extra={`第 ${step.code.start}–${end} 行`}>
                <CodeLines lines={step.code.lines} start={step.code.start} highlight={step.code.highlight ?? null} tone="info" />
              </Pane>
            </>
          );
        }}
      </Stepper>
    </div>
  );
}
