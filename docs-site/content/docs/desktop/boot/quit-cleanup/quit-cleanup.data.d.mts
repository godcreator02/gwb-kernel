/**
 * 「退出时等不等得到插件的清理」的讲解数据：画面（quit-cleanup.tsx）与机读版规则（quit-cleanup.ai.mjs）都只读这一份。
 * 每种情况画在同一根 0–6 秒的时间轴上：三条横道是内核、插件的清理、插件起的子进程，竖线是内核调用 app.quit() 的时刻。
 * 时长是示意，只有 5 秒这个上限来自源码；日志行照抄 main.ts 里写的原文。
 */
/** 时间轴的长度，秒 */
export const axisSeconds: 6;
export const cleanupTimeoutSeconds: 5;
/** 三条横道 */
export const lanes: {
    id: string;
    name: string;
    role: string;
}[];
/**
 * @typedef {{ lane: string, from: number, to: number, tone: 'info' | 'good' | 'warn' | 'bad', label: string }} Bar
 * @typedef {{ id: string, label: string, text: string, bars: Bar[], quitAt: number, log: string[] }} QuitCase
 * @type {QuitCase[]}
 */
export const cases: QuitCase[];
export type Bar = {
    lane: string;
    from: number;
    to: number;
    tone: "info" | "good" | "warn" | "bad";
    label: string;
};
export type QuitCase = {
    id: string;
    label: string;
    text: string;
    bars: Bar[];
    quitAt: number;
    log: string[];
};
