/**
 * 「一条请求从页面到插件再回来」的讲解数据：画面（request-trip.tsx）与机读版规则（request-trip.ai.mjs）都只读这一份。
 * 例子是页面上的外壳用命令插件的页面客户端调命令 shell.panes：命令插件登记了请求通道 commands.run，内核只按通道名转交。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、对应哪段源码。源码片段照抄 apps/desktop/，正上方的记号把它钉在源码上。
 */
/**
 * 参与者：页面上的代码琥珀色，preload 紫色，内核主进程蓝色，登记通道的命令插件绿色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/explainer/site').Role }[]}
 */
export const actors: {
    id: string;
    name: string;
    sub: string;
    role: import("@godcreator/explainer/site").Role;
}[];
/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} TripStep
 * @type {TripStep[]}
 */
export const steps: TripStep[];
export type Code = {
    file: string;
    start: number;
    lines: string[];
    highlight?: [number, number];
};
export type TripStep = {
    title: string;
    text: string;
    lit: string[];
    shown: string[];
    marks: Record<string, string>;
    code: Code;
};
