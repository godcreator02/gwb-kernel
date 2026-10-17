/**
 * LauncherCases 在机读版里变成什么：跟画面读同一份数据（launcher-cases.data.mjs）。
 * 先一段写按顺序的检查，再每种情况一段：清单长什么样、停在哪一道、结果（内核接手或弹框原因与退出码 1）。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/explainer';
import { cases, checks } from './launcher-cases.data.mjs';

export function LauncherCases(_node, { paragraph }) {
  const texts = casesText(cases);
  return [
    paragraph(`启动器按顺序检查，任何一道不过就停下：${checks.map((check, i) => `${i + 1}. ${check.text}`).join('；')}。`),
    ...cases.map((item, i) => {
      const manifest = item.manifest === null ? '清单文件不存在' : `清单：${item.manifest.join(' ')}`;
      const stop = item.stopAt === null ? '检查全部通过' : `停在「${checks.find((check) => check.id === item.stopAt).text}」`;
      const outcome = item.message === null ? '启动器 import 内核入口，内核接手' : `弹框「gwb 启动失败」：${item.message}；退出码 1`;
      return paragraph(`${texts[i]} ${manifest}。${stop}。结果：${outcome}。`);
    }),
  ];
}
