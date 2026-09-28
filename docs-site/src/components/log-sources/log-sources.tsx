'use client';
/**
 * 「一条日志从哪来、写成什么」：选一种情况，上面是谁写了这一句，中间一排是它经过的几步，下面左边是终端（stderr）上的文本，
 * 右边是 gwb.log 里的那一行 JSON，最后一行说它会不会触发只读状态页的推送。两种格式由数据模块里照内核写法的函数算出。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill, Terminal } from '@godcreator/docfirst-explainer';
import { cases, fileLineOf, terminalLineOf } from './log-sources.data.mjs';
import './log-sources.css';

type SourceCase = (typeof cases)[number];

function Picture({ item }: { item: SourceCase }): JSX.Element {
  return (
    <>
      <div className="ls-call">
        <Pill role="amber">写日志</Pill>
        <code>{item.call}</code>
      </div>
      <ol className="ls-path" aria-label="经过的几步">
        {item.path.map((stage, i) => (
          <li key={`${stage}-${i}`} className="ls-stage">
            {i === 0 ? null : (
              <span className="ls-arrow" aria-hidden="true">
                →
              </span>
            )}
            <span className="ls-chip" data-push={stage.startsWith('推 ')}>
              {stage}
            </span>
          </li>
        ))}
      </ol>
      <div className="ls-outputs">
        <Terminal title="stderr（给终端看的文本）" lines={terminalLineOf(item.record).split('\n')} />
        <Pane title="<home>\gwb.log（一行一个 JSON）" role="blue" icon="file">
          <CodeLines lines={[fileLineOf(item.record)]} tone="info" highlight={[1, 1]} />
        </Pane>
      </div>
      <div className="ls-foot">
        <Pill tone={item.pushes ? 'warn' : 'info'} dot>
          {item.pushes ? '是 error：200 毫秒后推一次 gwb:shell，没有外壳时显示在只读状态页' : '不是 error：只进日志，不推 gwb:shell'}
        </Pill>
      </div>
    </>
  );
}

export function LogSources(): JSX.Element {
  return (
    <div className="log-sources not-prose">
      <CasePicker cases={cases} label="一条日志从哪来、写成什么">
        {(item) => <Picture item={item} />}
      </CasePicker>
    </div>
  );
}
