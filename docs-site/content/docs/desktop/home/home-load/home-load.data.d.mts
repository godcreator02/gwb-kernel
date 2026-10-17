/**
 * 「从 GWB_HOME 到插件加载成功」的讲解数据：画面（home-load.tsx）与机读版规则（home-load.ai.mjs）都只读这一份。
 * 例子是一个名叫 demo 的 home，cordis.yml 里两条条目；每一步是一个固定状态：磁盘上亮哪几行、条目树长成什么样、对应哪段源码。
 * 源码片段照抄 apps/desktop/，正上方的记号把它钉在源码上；版本号 1.0.0 / 1.1.0 是示例。
 */
/**
 * 磁盘上 home 目录里讲解要用到的几行。`depth` 是缩进层级，`target` 是 junction 指向（pnpm 布局）。
 * @type {{ id: string, name: string, depth: number, note: string }[]}
 */
export const diskLines: {
    id: string;
    name: string;
    depth: number;
    note: string;
}[];
/** 第 8 步 junction 改指之后，外壳包那一行的指向 */
export const shellUpgradedNote: "\u2192 .pnpm\\@godcreator+gwb-shell@1.1.0\\\u2026";
/**
 * 条目树里的一个节点。`state` 用 cordis 的状态原名，还没有 fiber 时写 import 进行到哪
 * @typedef {{ id: string, name: string, depth: number, state: string, tone: 'good' | 'warn' | 'bad' | 'pending' | 'info' }} TreeNode
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number], example?: boolean }} Code
 * @typedef {{ title: string, text: string, diskLit: string[], shellNote?: string, tree: TreeNode[], code: Code }} LoadStep
 */
/** @type {LoadStep[]} */
export const steps: LoadStep[];
/**
 * 条目树里的一个节点。`state` 用 cordis 的状态原名，还没有 fiber 时写 import 进行到哪
 */
export type TreeNode = {
    id: string;
    name: string;
    depth: number;
    state: string;
    tone: "good" | "warn" | "bad" | "pending" | "info";
};
/**
 * 条目树里的一个节点。`state` 用 cordis 的状态原名，还没有 fiber 时写 import 进行到哪
 */
export type Code = {
    file: string;
    start: number;
    lines: string[];
    highlight?: [number, number];
    example?: boolean;
};
/**
 * 条目树里的一个节点。`state` 用 cordis 的状态原名，还没有 fiber 时写 import 进行到哪
 */
export type LoadStep = {
    title: string;
    text: string;
    diskLit: string[];
    shellNote?: string;
    tree: TreeNode[];
    code: Code;
};
