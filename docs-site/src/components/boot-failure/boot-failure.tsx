'use client';
/**
 * 「启动失败与插件出错时留下什么」：选一种情况，下面一排五格是 stderr、gwb.log、错误框、runtime.json、进程各自的结果。
 * 讲解文字与每格的结果在 boot-failure.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Dot, Pill } from '@godcreator/docfirst-explainer';
import { cases, outlets } from './boot-failure.data.mjs';
import './boot-failure.css';

export function BootFailureCases(): JSX.Element {
  return (
    <div className="not-prose">
      <CasePicker cases={cases} label="启动失败与插件出错时留下什么">
        {(item) => (
          <div className="bf-panel">
            <div className="bf-when">
              <Pill role="blue">{item.when}</Pill>
            </div>
            <div className="bf-row">
              {outlets.map((outlet) => {
                const outcome = item.outcomes[outlet.id];
                if (outcome === undefined) throw new Error(`启动失败图的情况「${item.id}」没有写「${outlet.id}」这一格`);
                return (
                  <div key={outlet.id} className="bf-cell" data-tone={outcome.tone ?? undefined} data-quiet={outcome.tone === null}>
                    <div className="bf-name">{outlet.name}</div>
                    <div className="bf-result">
                      {outcome.tone === null ? <span className="bf-none" /> : <Dot tone={outcome.tone} />}
                      <span>{outcome.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CasePicker>
    </div>
  );
}
