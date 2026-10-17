/**
 * 「从双击 gwb-kernel 到内核接手」的讲解数据：画面（launcher-boot.tsx）与机读版规则（launcher-boot.ai.mjs）都只读这一份。
 * 例子贯穿全页：不设 GWB_HOME 打开 default，安装包带 Electron 44.1.1，home 里装的是内核包 0.10.0。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、此刻环境变量 GWB_HOME 是什么、对应哪段源码。源码片段正上方的记号把它钉在源码上。
 */
/**
 * 参与者：启动器的两个文件是蓝色与紫色，home 里的内核包是灰色（包外的东西），Electron 也是灰色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/explainer/site').Role }[]}
 */
export const actors: {
    id: string;
    name: string;
    sub: string;
    role: import("@godcreator/explainer/site").Role;
}[];
/** 两个目录：上面是安装目录，下面是 default 这个 home */
export const bands: {
    id: string;
    label: string;
}[];
/** 例子里 default 的绝对路径 */
export const defaultHomeDir: "C:\\Users\\you\\AppData\\Roaming\\gwb-kernel\\homes\\default";
/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], env: string, code: Code }} BootStep
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
    env: string;
    code: Code;
};
