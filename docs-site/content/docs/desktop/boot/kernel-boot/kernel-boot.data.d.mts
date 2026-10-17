/**
 * 「内核一次启动」的讲解数据：画面（kernel-boot.tsx）与机读版规则（kernel-boot.ai.mjs）都只读这一份。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、个别参与者此刻的副标题、对应哪段源码。
 * 源码片段照抄 apps/，正上方的记号把它钉在源码上。
 */
/**
 * 参与者：内核的 main.ts 是蓝色，页面是紫色，home 里的文件是绿色，包外的启动器、Electron、cordis、插件、外壳是灰色
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
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} BootStep
 * @type {BootStep[]}
 */
export const steps: BootStep[];
export type Code = {
    file: string;
    start: number;
    lines: string[];
    highlight?: [number, number];
};
export type BootStep = {
    title: string;
    text: string;
    lit: string[];
    shown: string[];
    marks: Record<string, string>;
    code: Code;
};
