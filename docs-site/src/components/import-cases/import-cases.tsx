'use client';
/**
 * 「浏览器模块登记与页面准备的几种情况」：选一种情况，上面是这次的调用，左边是主进程的登记快照，右边是这份页面文档里已经注入的 importmap
 * （每段一张卡），下面是结果。主进程一侧蓝色、页面文档紫色；新出现的行绿色，改过的琥珀色，已经对不上的玫红。内容全在 import-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Pill } from '@godcreator/docfirst-explainer';
import { cases } from './import-cases.data.mjs';
import './import-cases.css';

type ImportCase = (typeof cases)[number];

const MARK_TEXT: Record<string, string> = { new: '新', changed: '变了', gone: '已对不上' };

function MarkBadge({ mark }: { mark: string | undefined }): JSX.Element | null {
  if (mark === undefined) return null;
  return <span className="ic-badge">{MARK_TEXT[mark]}</span>;
}

function Picture({ item }: { item: ImportCase }): JSX.Element {
  return (
    <>
      <div className="ic-call">
        <Pill role="slate">这次</Pill>
        <code>{item.call}</code>
      </div>
      <div className="ic-sides">
        <Pane title="主进程：登记快照" role="blue" icon="server">
          <ul className="ic-rows">
            {item.registry.map((row) => (
              <li key={row.name} className="ic-row" data-mark={row.mark}>
                <code className="ic-name">{row.name}</code>
                <code className="ic-url">{row.url}</code>
                <span className="ic-count">{row.count} 个登记者</span>
                <MarkBadge mark={row.mark} />
              </li>
            ))}
          </ul>
        </Pane>
        <Pane title="这份页面文档：已注入的 importmap" role="violet" icon="file">
          {item.documentMaps.length === 0 ? <p className="ic-empty">还没有注入过</p> : null}
          {item.documentMaps.map((map, i) => (
            <div key={i} className="ic-map">
              <div className="ic-map-title">{`<script type="importmap">`} 第 {i + 1} 段</div>
              <ul className="ic-rows">
                {map.map((row) => (
                  <li key={row.name} className="ic-row" data-mark={row.mark}>
                    <code className="ic-name">{row.name}</code>
                    <code className="ic-url">{row.url}</code>
                    <MarkBadge mark={row.mark} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Pane>
      </div>
      <div className="ic-result" data-tone={item.tone}>
        {item.result}
      </div>
    </>
  );
}

export function ImportCases(): JSX.Element {
  return (
    <div className="import-cases not-prose">
      <CasePicker cases={cases} label="浏览器模块登记与页面准备的几种情况">
        {(item) => <Picture item={item} />}
      </CasePicker>
    </div>
  );
}
