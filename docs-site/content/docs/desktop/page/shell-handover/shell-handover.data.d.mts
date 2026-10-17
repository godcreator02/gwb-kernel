/**
 * 「页面从只读状态页到交给外壳」的讲解数据：画面（shell-handover.tsx）与机读版规则（shell-handover.ai.mjs）都只读这一份。
 * 例子是一个外壳插件：它先登记浏览器模块，再调用 setShell 交出自己的页面模块地址，后来又被卸载。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、#root 此刻显示什么、对应哪段源码。源码片段照抄 apps/desktop/src/，正上方的记号把它钉在源码上。
 */
/**
 * 参与者：外壳插件绿色，内核主进程蓝色，preload 紫色，页面入口青色，#root 琥珀色
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
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} HandoverStep
 * @type {HandoverStep[]}
 */
export const steps: HandoverStep[];
export type Code = {
    file: string;
    start: number;
    lines: string[];
    highlight?: [number, number];
};
export type HandoverStep = {
    title: string;
    text: string;
    lit: string[];
    shown: string[];
    marks: Record<string, string>;
    code: Code;
};
