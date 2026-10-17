/**
 * BootFailureCases 在机读版里变成什么：跟画面读同一份数据（boot-failure.data.mjs），每种情况一段话，后面列出五处各自的结果。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/explainer';
import { cases, outlets } from './boot-failure.data.mjs';

export function BootFailureCases(_node, { paragraph }) {
  const texts = casesText(cases);
  return cases.map((item, i) => {
    const results = outlets.map((outlet) => `${outlet.name}：${item.outcomes[outlet.id].text}`).join('；');
    return paragraph(`${texts[i]}（发生在${item.when}。${results}）`);
  });
}
