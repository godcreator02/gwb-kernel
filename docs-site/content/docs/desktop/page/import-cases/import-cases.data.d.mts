/**
 * @typedef {'new' | 'gone' | 'changed' | undefined} Mark
 * @typedef {{ name: string, url: string, count: number, mark?: Mark }} RegistryRow
 * @typedef {{ name: string, url: string, mark?: Mark }} MapRow
 * @typedef {{ id: string, label: string, text: string, call: string, registry: RegistryRow[], documentMaps: MapRow[][], result: string, tone: 'good' | 'bad' | 'warn' }} ImportCase
 * @type {ImportCase[]}
 */
export const cases: ImportCase[];
export type Mark = "new" | "gone" | "changed" | undefined;
export type RegistryRow = {
    name: string;
    url: string;
    count: number;
    mark?: Mark;
};
export type MapRow = {
    name: string;
    url: string;
    mark?: Mark;
};
export type ImportCase = {
    id: string;
    label: string;
    text: string;
    call: string;
    registry: RegistryRow[];
    documentMaps: MapRow[][];
    result: string;
    tone: "good" | "bad" | "warn";
};
