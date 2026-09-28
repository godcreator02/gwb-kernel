/**
 * HomeLoadSteps 在机读版里变成什么：跟画面读同一份数据（home-load.data.mjs），每一步一段话，
 * 后面跟这一步条目树的样子与对应的源码位置。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import { steps } from './home-load.data.mjs';

function treeText(tree) {
  if (tree.length === 0) return '条目树还不存在';
  return `条目树：${tree.map((node) => `${node.id}（${node.name}，${node.state}）`).join('；')}`;
}

function codeText(code) {
  if (code.example === true) return `示例 ${code.file}：${code.lines.join(' / ')}`;
  return `源码：${code.file} 第 ${code.start}–${code.start + code.lines.length - 1} 行`;
}

export function HomeLoadSteps(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.map((step, i) => paragraph(`${texts[i]}（${treeText(step.tree)}。${codeText(step.code)}）`));
}
