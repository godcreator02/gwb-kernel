/**
 * QuitCleanupCases 在机读版里变成什么：跟画面读同一份数据（quit-cleanup.data.mjs），每种情况一段话，后面写内核在第几秒调用 app.quit() 与写出的日志行。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/explainer-player/text';
import { cases, cleanupTimeoutSeconds } from './quit-cleanup.data.mjs';

export function QuitCleanupCases(_node, { paragraph }) {
  const texts = casesText(cases);
  const intro = paragraph(`退出时内核最多等插件的清理 ${cleanupTimeoutSeconds} 秒；下面各情况里的时长是示意。`);
  return [
    intro,
    ...cases.map((item, i) => {
      const log = item.log.length === 0 ? '' : `；日志：${item.log.join(' / ')}`;
      return paragraph(`${texts[i]}（示意中内核在第 ${item.quitAt} 秒调用 app.quit()${log}）`);
    }),
  ];
}
