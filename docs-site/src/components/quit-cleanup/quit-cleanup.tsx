'use client';
/**
 * 「退出时等不等得到插件的清理」：选一种情况，上面是同一根 0–6 秒的时间轴，三条横道是内核、插件的清理、插件起的子进程，
 * 竖线是内核调用 app.quit() 的时刻、虚线是 5 秒上限；下面的终端是这一次退出写出的日志行。讲解文字与数据在 quit-cleanup.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Terminal } from '@godcreator/docfirst-explainer';
import type { TerminalLine } from '@godcreator/docfirst-explainer';
import { axisSeconds, cases, cleanupTimeoutSeconds, lanes } from './quit-cleanup.data.mjs';
import './quit-cleanup.css';

const VIEW = { w: 720, h: 196 };
const LEFT = 120;
const RIGHT = 700;
const LANE_TOP = 24;
const LANE_H = 34;
const LANE_GAP = 10;

function xOf(seconds: number): number {
  return LEFT + ((RIGHT - LEFT) * seconds) / axisSeconds;
}

function laneY(laneId: string): number {
  const index = lanes.findIndex((lane) => lane.id === laneId);
  if (index < 0) throw new Error(`退出清理图里没有横道「${laneId}」`);
  return LANE_TOP + index * (LANE_H + LANE_GAP);
}

const AXIS_Y = LANE_TOP + lanes.length * (LANE_H + LANE_GAP) + 4;
const TICKS = Array.from({ length: axisSeconds + 1 }, (_, i) => i);

function terminalLinesOf(log: readonly string[]): TerminalLine[] {
  if (log.length === 0) return [{ text: '（没有清理那一行）', kind: 'out' }];
  return log.map((text): TerminalLine => ({ text, kind: text.startsWith('warn') ? 'err' : 'out' }));
}

export function QuitCleanupCases(): JSX.Element {
  return (
    <div className="not-prose">
      <CasePicker cases={cases} label="退出时等不等得到插件的清理">
        {(item) => (
          <div className="qc-panel">
            <div className="qc-scroll">
              <svg className="qc-svg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" aria-label={item.label}>
                {lanes.map((lane) => (
                  <g key={lane.id} className="qc-lane" data-role={lane.role}>
                    <rect x={LEFT} y={laneY(lane.id)} width={RIGHT - LEFT} height={LANE_H} rx={8} />
                    <text x={LEFT - 10} y={laneY(lane.id) + LANE_H / 2} textAnchor="end" dominantBaseline="central">
                      {lane.name}
                    </text>
                  </g>
                ))}
                {item.bars.map((bar) => {
                  const x = xOf(bar.from);
                  const w = Math.max(xOf(bar.to) - x, 4);
                  const y = laneY(bar.lane) + 5;
                  return (
                    <g key={`${item.id}-${bar.lane}`} className="qc-bar" data-tone={bar.tone}>
                      <rect x={x} y={y} width={w} height={LANE_H - 10} rx={6} />
                      <text x={x + Math.max(w, 4) + 6 > RIGHT - 120 ? x + 8 : x + w + 6} y={y + (LANE_H - 10) / 2} dominantBaseline="central">
                        {bar.label}
                      </text>
                    </g>
                  );
                })}
                <g className="qc-limit">
                  <line x1={xOf(cleanupTimeoutSeconds)} y1={LANE_TOP - 8} x2={xOf(cleanupTimeoutSeconds)} y2={AXIS_Y} />
                  <text x={xOf(cleanupTimeoutSeconds)} y={LANE_TOP - 12} textAnchor="middle">
                    {`最多等 ${cleanupTimeoutSeconds} 秒`}
                  </text>
                </g>
                <g className="qc-quit" key={`quit-${item.id}`}>
                  <line x1={xOf(item.quitAt)} y1={LANE_TOP - 4} x2={xOf(item.quitAt)} y2={AXIS_Y} />
                  <text x={xOf(item.quitAt) + 4} y={AXIS_Y + 26}>
                    app.quit()
                  </text>
                </g>
                <g className="qc-axis">
                  <line x1={LEFT} y1={AXIS_Y} x2={RIGHT} y2={AXIS_Y} />
                  {TICKS.map((second) => (
                    <text key={second} x={xOf(second)} y={AXIS_Y + 12} textAnchor="middle">
                      {`${second}s`}
                    </text>
                  ))}
                </g>
              </svg>
            </div>
            <Terminal title="stderr（省略时间）" lines={terminalLinesOf(item.log)} />
          </div>
        )}
      </CasePicker>
    </div>
  );
}
