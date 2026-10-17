/**
 * 「启动器遇到的几种 home」：选一种情况，左边是 home 里内核包的清单（没有就写「文件不存在」），右边是按顺序的检查，
 * 走过的打勾、停下的那一道标红、后面的淡下去；最下面是结果：内核接手，或者启动器的弹框与退出码。内容全在 launcher-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { cases, checks, manifestFile } from './launcher-cases.data.mjs';
import './launcher-cases.css';

type LauncherCase = (typeof cases)[number];
type CheckState = 'pass' | 'stop' | 'skip';

const STATE_TEXT: Record<CheckState, string> = { pass: '通过', stop: '在这里停下', skip: '没走到' };

function checkStates(item: LauncherCase): CheckState[] {
  const stopIndex = item.stopAt === null ? checks.length : checks.findIndex((check) => check.id === item.stopAt);
  if (stopIndex === -1) throw new Error(`启动器的情况「${item.id}」停在不存在的检查「${item.stopAt}」`);
  return checks.map((_check, i) => (i < stopIndex ? 'pass' : i === stopIndex ? 'stop' : 'skip'));
}

function ManifestPane({ item }: { item: LauncherCase }): JSX.Element {
  return (
    <Pane title="home 里内核包的清单" role="slate" icon="file" extra="package.json">
      <div className="lc-path">{manifestFile}</div>
      {item.manifest === null ? <div className="lc-missing">文件不存在</div> : <CodeLines lines={item.manifest} />}
    </Pane>
  );
}

function CheckLadder({ item }: { item: LauncherCase }): JSX.Element {
  const states = checkStates(item);
  return (
    <Pane title="启动器按顺序检查" role="violet" extra="kernelEntryFor → import">
      <ol className="lc-rows">
        {checks.map((check, i) => (
          <li key={check.id} className="lc-row" data-state={states[i]}>
            <span className="lc-row-no">{i + 1}</span>
            <span className="lc-row-text">{check.text}</span>
            <span className="lc-row-state">{STATE_TEXT[states[i]!]}</span>
          </li>
        ))}
      </ol>
    </Pane>
  );
}

function Outcome({ item }: { item: LauncherCase }): JSX.Element {
  if (item.message === null) {
    return (
      <div className="lc-ok">
        <Pill tone="good" dot>
          内核接手
        </Pill>
        <span>import 返回后启动器不再做任何事，窗口由内核在 Electron ready 之后打开。</span>
      </div>
    );
  }
  return (
    <div className="lc-dialog" role="group" aria-label="启动器的弹框">
      <div className="lc-dialog-title">gwb 启动失败</div>
      <div className="lc-dialog-body">{item.message}</div>
      <div className="lc-dialog-foot">
        <Pill tone="bad">退出码 1</Pill>
        <code>stderr：gwb-launcher: {item.message}</code>
      </div>
    </div>
  );
}

export function LauncherCases(): JSX.Element {
  return (
    <div className="launcher-cases not-prose">
      <CasePicker cases={cases} label="启动器遇到的几种 home">
        {(item) => (
          <>
            <div className="lc-grid">
              <ManifestPane item={item} />
              <CheckLadder item={item} />
            </div>
            <Outcome item={item} />
          </>
        )}
      </CasePicker>
    </div>
  );
}
