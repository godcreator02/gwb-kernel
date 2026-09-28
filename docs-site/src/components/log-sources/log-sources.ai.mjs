/**
 * LogSources 在机读版里变成什么：跟画面读同一份数据（log-sources.data.mjs），每种情况一段：
 * 说明、谁写的、经过哪几步、gwb.log 里的那一行、终端上的文本、会不会推送。这个文件不 import React，docfirst.config.mjs 引它。
 */
import { casesText } from '@godcreator/docfirst-explainer/text';
import { cases, fileLineOf, terminalLineOf } from './log-sources.data.mjs';

export function LogSources(_node, { paragraph }) {
  const texts = casesText(cases);
  return cases.map((item, i) =>
    paragraph(
      `${texts[i]} 写日志：${item.call}。经过：${item.path.join(' → ')}。gwb.log 里：${fileLineOf(item.record)}。` +
        `终端上：${JSON.stringify(terminalLineOf(item.record))}。${item.pushes ? '会推一次 gwb:shell' : '不推 gwb:shell'}。`,
    ),
  );
}
