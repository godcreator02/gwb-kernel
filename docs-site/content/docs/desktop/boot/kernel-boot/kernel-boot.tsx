/**
 * 「内核一次启动」：三条泳道从上往下是主进程（启动器、入口模块求值、ready 之后、Electron、cordis、loader、插件）、
 * 页面（窗口、index.html、外壳模块）、home 目录（gwb.log、两个启动文件、runtime.json、node_modules）。
 * 每一步亮起这一步参与的方块、画出这一步走过的箭头，下面给出这一步对应的源码。讲解文字与源码在 kernel-boot.data.mjs。
 */
import type { JSX } from 'react';
import { Stepper } from '@godcreator/explainer/site';
import { CodeBlock, Lanes } from '../../../_shared/desktop-lanes/lanes';
import type { LaneActor, LaneBand, LaneFlow } from '../../../_shared/desktop-lanes/lanes';
import { actors, steps } from './kernel-boot.data.mjs';

const VIEW = { w: 820, h: 408 };

const BANDS: LaneBand[] = [
  { label: '主进程', y: 8, h: 196 },
  { label: '页面', y: 214, h: 86 },
  { label: 'home 目录', y: 308, h: 92 },
];

const BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  launcher: { x: 20, y: 40, w: 150, h: 52 },
  eval: { x: 200, y: 40, w: 180, h: 52 },
  ready: { x: 410, y: 40, w: 180, h: 52 },
  electron: { x: 620, y: 40, w: 180, h: 52 },
  cordis: { x: 200, y: 136, w: 180, h: 52 },
  loader: { x: 410, y: 136, w: 180, h: 52 },
  plugins: { x: 620, y: 136, w: 180, h: 52 },
  window: { x: 200, y: 240, w: 180, h: 52 },
  page: { x: 410, y: 240, w: 180, h: 52 },
  shell: { x: 620, y: 240, w: 180, h: 52 },
  log: { x: 20, y: 336, w: 150, h: 52 },
  files: { x: 200, y: 336, w: 180, h: 52 },
  rt: { x: 410, y: 336, w: 180, h: 52 },
  nm: { x: 620, y: 336, w: 180, h: 52 },
};

const FLOWS: LaneFlow[] = [
  { id: 'manifest', points: [[95, 92], [95, 304], [710, 304], [710, 336]], label: 'engines.electron · main', labelAt: [400, 300] },
  { id: 'import', points: [[170, 66], [200, 66]] },
  { id: 'lock', points: [[290, 40], [290, 24], [710, 24], [710, 40]], label: 'requestSingleInstanceLock', labelAt: [500, 20] },
  { id: 'openlog', points: [[230, 92], [230, 112], [120, 112], [120, 336]], label: 'openLogFile', labelAt: [175, 108] },
  { id: 'check', points: [[380, 80], [395, 80], [395, 304], [290, 304], [290, 336]], label: 'existsSync', labelAt: [340, 300] },
  { id: 'writert', points: [[395, 304], [500, 304], [500, 336]], label: 'writeFileSync', labelAt: [455, 300] },
  { id: 'provide', points: [[290, 92], [290, 136]], label: 'ctx.provide', labelAt: [335, 118] },
  { id: 'whenready', points: [[620, 66], [590, 66]] },
  { id: 'openwin', points: [[440, 92], [440, 112], [395, 112], [395, 210], [290, 210], [290, 240]], label: 'loadFile(index.html)', labelAt: [330, 208] },
  { id: 'winpage', points: [[380, 266], [410, 266]] },
  { id: 'plugloader', points: [[500, 92], [500, 136]], label: 'ctx.plugin(Loader)', labelAt: [560, 118] },
  { id: 'readyml', points: [[410, 176], [398, 176], [398, 304], [290, 304], [290, 336]], label: 'cordis.yml', labelAt: [340, 300] },
  { id: 'resolve', points: [[560, 188], [560, 200], [605, 200], [605, 304], [710, 304], [710, 336]], label: 'bareImportFromHome', labelAt: [680, 300] },
  { id: 'apply', points: [[590, 162], [620, 162]] },
  { id: 'setshell', points: [[650, 188], [650, 208], [500, 208], [500, 240]], label: 'setShell(url) → gwb:shell', labelAt: [575, 204] },
  { id: 'mountshell', points: [[590, 266], [620, 266]] },
  { id: 'up', points: [[410, 80], [398, 80], [398, 304], [120, 304], [120, 336]], label: 'kernelLog.info(up)', labelAt: [250, 300] },
];

function placed(actor: (typeof actors)[number]): LaneActor {
  const box = BOX[actor.id];
  if (box === undefined) throw new Error(`内核启动图的布局表里没有参与者「${actor.id}」`);
  return { ...actor, ...box };
}

const ACTORS = actors.map(placed);

export function KernelBootSteps(): JSX.Element {
  return (
    <div className="not-prose">
      <Stepper steps={steps} label="内核一次启动" interval={6500}>
        {(step) => (
          <>
            <Lanes view={VIEW} bands={BANDS} actors={ACTORS} flows={FLOWS} lit={step.lit} shown={step.shown} marks={step.marks} label={step.title} />
            <CodeBlock code={step.code} role={step.code.file.startsWith('apps/launcher') ? 'slate' : step.code.file.endsWith('.html') ? 'violet' : 'blue'} />
          </>
        )}
      </Stepper>
    </div>
  );
}
