/**
 * 「一次启动与一条命令」的讲解数据：画面（boot-and-request.tsx）与机读版规则（boot-and-request.ai.mjs）都只读这一份。
 * 每一步是一组消息：从哪条竖线到哪条竖线、箭头上写什么、走的是首页接缝图上的第几条接缝（null 是内核包内部的 IPC）。
 * 箭头上的名字照抄源码，正上方的记号把它钉在源码上。
 */
/**
 * 竖线：安装包是琥珀色、内核是蓝色，与首页接缝图一致；包外的东西是灰色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/explainer/site').Role }[]}
 */
export const lanes: {
    id: string;
    name: string;
    sub: string;
    role: import("@godcreator/explainer/site").Role;
}[];
/**
 * @typedef {{ from: string, to: string, label: string, seam: number | null }} Message
 * @typedef {{ title: string, text: string, messages: Message[] }} BootStep
 * @type {BootStep[]}
 */
export const steps: BootStep[];
export type Message = {
    from: string;
    to: string;
    label: string;
    seam: number | null;
};
export type BootStep = {
    title: string;
    text: string;
    messages: Message[];
};
