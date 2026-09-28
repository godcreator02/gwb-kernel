/**
 * LauncherBootSteps 在机读版里变成什么：跟画面读同一份数据（launcher-boot.data.mjs），每一步一段话，
 * 后面跟这一步 GWB_HOME 的值与对应的源码位置。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import { steps } from './launcher-boot.data.mjs';

export function LauncherBootSteps(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.map((step, i) => {
    const end = step.code.start + step.code.lines.length - 1;
    return paragraph(`${texts[i]}（此刻 GWB_HOME = ${step.env}；源码：${step.code.file} 第 ${step.code.start}–${end} 行）`);
  });
}
