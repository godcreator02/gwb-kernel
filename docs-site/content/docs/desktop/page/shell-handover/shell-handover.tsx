/**
 * 「页面从只读状态页到交给外壳」：上面一条泳道是主进程（外壳插件、内核服务、浏览器模块登记），下面一条是页面（#root、页面入口、preload）。
 * 每一步亮起这一步参与的方块、画出这一步走过的箭头，#root 的副标题写它此刻显示什么，下面给出这一步对应的源码。讲解文字与源码在 shell-handover.data.mjs。
 */
import type { JSX } from 'react';
import { Stepper } from '@godcreator/explainer/site';
import { CodeBlock, Lanes } from '../../../_shared/desktop-lanes/lanes';
import type { LaneActor, LaneBand, LaneFlow } from '../../../_shared/desktop-lanes/lanes';
import { actors, steps } from './shell-handover.data.mjs';

const VIEW = { w: 780, h: 310 };

const BANDS: LaneBand[] = [
  { label: '主进程', y: 8, h: 120 },
  { label: '页面（主世界与 preload）', y: 144, h: 158 },
];

const BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  plugin: { x: 24, y: 48, w: 170, h: 56 },
  kernel: { x: 300, y: 48, w: 180, h: 56 },
  registry: { x: 580, y: 48, w: 176, h: 56 },
  root: { x: 24, y: 212, w: 170, h: 56 },
  page: { x: 300, y: 212, w: 180, h: 56 },
  preload: { x: 580, y: 212, w: 176, h: 56 },
};

const FLOWS: LaneFlow[] = [
  { id: 'register', points: [[109, 48], [109, 30], [668, 30], [668, 48]], label: 'registerImports', labelAt: [540, 25] },
  { id: 'setShell', points: [[194, 76], [300, 76]], label: 'setShell', labelAt: [247, 70] },
  { id: 'revoke', points: [[194, 76], [300, 76]], label: '撤销函数', labelAt: [247, 70] },
  { id: 'shellMsg', points: [[390, 104], [390, 212]], label: 'gwb:shell { url, report }', labelAt: [390, 166] },
  { id: 'hello', points: [[610, 212], [610, 184], [450, 184], [450, 104]], label: 'gwb:hello', labelAt: [530, 179] },
  { id: 'imports', points: [[710, 212], [710, 104]], label: 'gwb:imports', labelAt: [710, 166] },
  { id: 'draw', points: [[300, 240], [194, 240]], label: '画状态页', labelAt: [247, 234] },
  { id: 'mount', points: [[300, 240], [194, 240]], label: 'default(root)', labelAt: [247, 234] },
];

function placed(actor: (typeof actors)[number]): LaneActor {
  const box = BOX[actor.id];
  if (box === undefined) throw new Error(`外壳交接图的布局表里没有参与者「${actor.id}」`);
  return { ...actor, ...box };
}

const ACTORS = actors.map(placed);

const CODE_ROLE: Record<string, 'blue' | 'violet' | 'cyan'> = {
  'apps/desktop/src/main.ts': 'blue',
  'apps/desktop/src/preload.cjs': 'violet',
  'apps/desktop/src/index.html': 'cyan',
};

export function ShellHandoverSteps(): JSX.Element {
  return (
    <div className="not-prose">
      <Stepper steps={steps} label="页面从只读状态页到交给外壳" interval={7000}>
        {(step) => (
          <>
            <Lanes view={VIEW} bands={BANDS} actors={ACTORS} flows={FLOWS} lit={step.lit} shown={step.shown} marks={step.marks} label={step.title} />
            <CodeBlock code={step.code} role={CODE_ROLE[step.code.file] ?? 'slate'} />
          </>
        )}
      </Stepper>
    </div>
  );
}
