/**
 * 「请求通道的几种结局」的讲解数据：画面（request-outcomes.tsx）与机读版规则（request-outcomes.ai.mjs）都只读这一份。
 * 每种情况三栏：页面怎么调用、主进程回了什么（或抛了什么）、页面最后拿到什么；另记处理器有没有被调用。
 * 报错原文照抄 apps/desktop/src/，正上方的记号把它钉在源码上；命令名与回执内容是示例。
 */
/**
 * @typedef {{ id: string, label: string, text: string, call: string, reply: string, replyKind: 'value' | 'throw', page: string, pageKind: 'resolve' | 'reject', handlerRan: boolean }} OutcomeCase
 * @type {OutcomeCase[]}
 */
export const cases: OutcomeCase[];
export type OutcomeCase = {
    id: string;
    label: string;
    text: string;
    call: string;
    reply: string;
    replyKind: "value" | "throw";
    page: string;
    pageKind: "resolve" | "reject";
    handlerRan: boolean;
};
