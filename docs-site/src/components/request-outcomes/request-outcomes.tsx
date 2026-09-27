'use client';
/**
 * 「请求通道的几种结局」：选一种情况，三张卡从左到右是页面的调用、主进程的回复、页面最后拿到的结果，下面一行说处理器有没有被调用。
 * 页面一侧琥珀色、主进程蓝色；兑现用绿色语气、拒绝用玫红语气。内容全在 request-outcomes.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Pill } from '@godcreator/explainer-player';
import { cases } from './request-outcomes.data.mjs';
import './request-outcomes.css';

type OutcomeCase = (typeof cases)[number];

function Picture({ item }: { item: OutcomeCase }): JSX.Element {
  return (
    <>
      <div className="ro-row">
        <Pane title="页面调用" role="amber">
          <code className="ro-code">{item.call}</code>
        </Pane>
        <span className="ro-arrow" aria-hidden="true">
          →
        </span>
        <Pane title="主进程回复" role="blue">
          <code className="ro-code" data-kind={item.replyKind}>
            {item.reply}
          </code>
        </Pane>
        <span className="ro-arrow" aria-hidden="true">
          →
        </span>
        <Pane title="页面拿到" role="amber">
          <code className="ro-code ro-result" data-tone={item.pageKind === 'resolve' ? 'good' : 'bad'}>
            {item.page}
          </code>
        </Pane>
      </div>
      <div className="ro-foot">
        <Pill tone={item.handlerRan ? 'good' : 'warn'} dot>
          {item.handlerRan ? '处理器被调用了' : '处理器没有被调用'}
        </Pill>
      </div>
    </>
  );
}

export function RequestOutcomes(): JSX.Element {
  return (
    <div className="request-outcomes not-prose">
      <CasePicker cases={cases} label="请求通道的几种结局">
        {(item) => <Picture item={item} />}
      </CasePicker>
    </div>
  );
}
