/**
 * ImportCases 在机读版里变成什么：跟画面读同一份数据（import-cases.data.mjs），每种情况一段：
 * 说明、这次的调用、主进程快照、页面文档里已注入的 importmap、结果。这个文件不 import React，docfirst.config.mjs 引它。
 */
import { casesText } from '@godcreator/explainer-player/text';
import { cases } from './import-cases.data.mjs';

const registryText = (rows) => rows.map((row) => `${row.name} → ${row.url}（${row.count} 个登记者）`).join('；');
const mapsText = (maps) =>
  maps.length === 0 ? '还没有注入过' : maps.map((map, i) => `第 ${i + 1} 段：${map.map((row) => `${row.name} → ${row.url}`).join('、')}`).join('；');

export function ImportCases(_node, { paragraph }) {
  const texts = casesText(cases);
  return cases.map((item, i) =>
    paragraph(`${texts[i]} 这次：${item.call}。主进程快照：${registryText(item.registry)}。页面文档：${mapsText(item.documentMaps)}。结果：${item.result}。`),
  );
}
