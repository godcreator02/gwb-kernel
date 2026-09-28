/**
 * ShellHandoverSteps 在机读版里变成什么：跟画面读同一份数据（shell-handover.data.mjs），每一步一段话，
 * 后面跟 #root 此刻显示什么与这一步对应的源码位置。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import { steps } from './shell-handover.data.mjs';

export function ShellHandoverSteps(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.map((step, i) => {
    const end = step.code.start + step.code.lines.length - 1;
    const root = step.marks.root === undefined ? '' : `#root：${step.marks.root}。`;
    return paragraph(`${texts[i]}（${root}源码：${step.code.file} 第 ${step.code.start}–${end} 行）`);
  });
}
