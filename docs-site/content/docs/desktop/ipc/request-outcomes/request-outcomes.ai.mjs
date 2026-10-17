/**
 * RequestOutcomes 在机读版里变成什么：跟画面读同一份数据（request-outcomes.data.mjs），每种情况一段：
 * 说明、页面的调用、主进程的回复、页面拿到什么、处理器有没有被调用。这个文件不 import React，docfirst.config.mjs 引它。
 */
import { casesText } from '@godcreator/explainer';
import { cases } from './request-outcomes.data.mjs';

export function RequestOutcomes(_node, { paragraph }) {
  const texts = casesText(cases);
  return cases.map((item, i) =>
    paragraph(
      `${texts[i]} 调用：${item.call}。主进程：${item.reply}。页面：${item.page}。${item.handlerRan ? '处理器被调用了' : '处理器没有被调用'}。`,
    ),
  );
}
