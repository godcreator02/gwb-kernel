/**
 * 「启动失败与插件出错时留下什么」的讲解数据：画面（boot-failure.tsx）与机读版规则（boot-failure.ai.mjs）都只读这一份。
 * 每种情况给出五处各自的结果：stderr、gwb.log、错误框、runtime.json、进程。
 * tone 是那一格的颜色：info 写了或弹了，bad 退出，good 照常运行，null 没有动静。
 */
/** 五处，按一次启动里先后碰到的顺序 */
export const outlets: {
    id: string;
    name: string;
}[];
/**
 * @typedef {{ tone: 'info' | 'bad' | 'good' | null, text: string }} Outcome
 * @typedef {{ id: string, label: string, text: string, when: string, outcomes: Record<string, Outcome> }} FailureCase
 * @type {FailureCase[]}
 */
export const cases: FailureCase[];
export type Outcome = {
    tone: "info" | "bad" | "good" | null;
    text: string;
};
export type FailureCase = {
    id: string;
    label: string;
    text: string;
    when: string;
    outcomes: Record<string, Outcome>;
};
