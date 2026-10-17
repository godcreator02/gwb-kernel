/**
 * BootAndRequestSteps 在机读版里变成什么：跟画面读同一份数据（boot-and-request.data.mjs），每一步一段话，
 * 后面跟这一步依次发生的消息与各自走的接缝编号。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/explainer';
import { lanes, steps } from './boot-and-request.data.mjs';

const laneName = (id) => {
  const lane = lanes.find((l) => l.id === id);
  if (lane === undefined) throw new Error(`「一次启动与一条命令」里没有竖线「${id}」`);
  return lane.name;
};

const messageText = (m) =>
  `${laneName(m.from)} → ${laneName(m.to)}：${m.label}（${m.seam === null ? '内核包内部的 IPC' : `接缝 ${m.seam}`}）`;

export function BootAndRequestSteps(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.map((step, i) => paragraph(`${texts[i]} 消息依次是：${step.messages.map(messageText).join('；')}。`));
}
