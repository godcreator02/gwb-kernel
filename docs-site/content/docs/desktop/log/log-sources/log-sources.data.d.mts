/** gwb.log 里的一行：五个键、顺序固定，行尾一个换行（画面里不显示那个换行） */
export function fileLineOf({ ts, level, name, msg }: {
    ts: any;
    level: any;
    name: any;
    msg: any;
}): string;
/** 终端上的一行：「时间 级别 名字 正文」，正文里的换行原样输出 */
export function terminalLineOf({ ts, level, name, msg }: {
    ts: any;
    level: any;
    name: any;
    msg: any;
}): string;
/**
 * @typedef {{ ts: string, level: 'error' | 'warn' | 'info' | 'debug', name: string, msg: string }} Written
 * @typedef {{ id: string, label: string, text: string, call: string, path: string[], record: Written, pushes: boolean }} SourceCase
 * @type {SourceCase[]}
 */
export const cases: SourceCase[];
export type Written = {
    ts: string;
    level: "error" | "warn" | "info" | "debug";
    name: string;
    msg: string;
};
export type SourceCase = {
    id: string;
    label: string;
    text: string;
    call: string;
    path: string[];
    record: Written;
    pushes: boolean;
};
