'use client';
/**
 * 「从 GWB_HOME 到插件加载成功」：左边是磁盘上的 home 目录（这一步读写的那几行亮起），右边是内存里 loader 的条目树（这一步长成什么样），
 * 下面是这一步对应的源码。讲解文字与源码在 home-load.data.mjs。磁盘一侧用琥珀色，内核与条目树用蓝色。
 */
import type { JSX } from 'react';
import { Dot, Pane, Stepper } from '@godcreator/explainer-player';
import { CodeBlock } from '../desktop-lanes/lanes';
import { diskLines, steps } from './home-load.data.mjs';
import './home-load.css';

type LoadStep = (typeof steps)[number];

function DiskPane({ step }: { step: LoadStep }): JSX.Element {
  const lit = new Set(step.diskLit);
  return (
    <Pane title="磁盘：home 目录" role="amber" icon="folder">
      <ul className="hl-disk">
        {diskLines.map((line) => (
          <li key={line.id} className="hl-line" data-lit={lit.has(line.id)} style={{ paddingLeft: `${line.depth * 1.4}em` }}>
            <span className="hl-file">{line.name}</span>
            <span className="hl-note">{line.id === 'shell' && step.shellNote !== undefined ? step.shellNote : line.note}</span>
          </li>
        ))}
      </ul>
    </Pane>
  );
}

function TreePane({ step }: { step: LoadStep }): JSX.Element {
  return (
    <Pane title="内存：loader 的条目树" role="blue" icon="server">
      {step.tree.length === 0 ? (
        <p className="hl-empty">cordis 实例还没创建，条目树还不存在</p>
      ) : (
        <ul className="hl-tree">
          <li className="hl-node hl-root">loader 根层</li>
          {step.tree.map((node) => (
            <li key={node.id} className="hl-node" style={{ paddingLeft: `${(node.depth + 1) * 1.4}em` }}>
              <code className="hl-id">{node.id}</code>
              <span className="hl-name">{node.name}</span>
              <span className="hl-state" data-tone={node.tone}>
                <Dot tone={node.tone} />
                {node.state}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Pane>
  );
}

export function HomeLoadSteps(): JSX.Element {
  return (
    <div className="home-load not-prose">
      <Stepper steps={steps} label="从 GWB_HOME 到插件加载成功" interval={7000}>
        {(step) => (
          <>
            <div className="hl-panes">
              <DiskPane step={step} />
              <TreePane step={step} />
            </div>
            <CodeBlock code={step.code} role={step.code.example === true ? 'amber' : 'blue'} />
          </>
        )}
      </Stepper>
    </div>
  );
}
