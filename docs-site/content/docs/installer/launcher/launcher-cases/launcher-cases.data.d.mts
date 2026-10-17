/**
 * 「启动器遇到的几种 home」的讲解数据：画面（launcher-cases.tsx）与机读版规则（launcher-cases.ai.mjs）都只读这一份。
 * 每种情况：home 里内核包的清单长什么样、按顺序的几道检查走到哪一道停下、结果是内核接手还是弹框。
 * 例子里的 home 是 default，安装包带 Electron 44.1.1。弹框的原因照抄 apps/launcher/src/launch-plan.ts 与 main.ts，
 * 只把 ${…} 换成例子里的值，正上方的记号把它钉在源码上。
 */
export const homeDir: "C:\\Users\\you\\AppData\\Roaming\\gwb-kernel\\homes\\default";
export const manifestFile: "C:\\Users\\you\\AppData\\Roaming\\gwb-kernel\\homes\\default\\node_modules\\@godcreator\\gwb-kernel-desktop\\package.json";
/** 按顺序的检查：前五道在 kernelEntryFor 里，最后一道是 main.ts 的动态 import */
export const checks: {
    id: string;
    text: string;
}[];
/**
 * @typedef {{ id: string, label: string, text: string, manifest: string[] | null, stopAt: string | null, message: string | null }} LauncherCase
 * @type {LauncherCase[]}
 */
export const cases: LauncherCase[];
export type LauncherCase = {
    id: string;
    label: string;
    text: string;
    manifest: string[] | null;
    stopAt: string | null;
    message: string | null;
};
