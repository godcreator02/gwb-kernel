// 假件：模仿今天 gwb 件对「独立分发的包」的用法——从不 import 它的代码，
// 只用模块解析算出它的路径，然后去读它的文件。
//
// 三条取址方式并排放着，就是为了对比：
//   frozen           模块求值时算一次、此后攥着（今天件的做法）
//   resolveNow()     每次现算 import.meta.resolve
//   requireResolveNow()  每次现算 createRequire().resolve（内核解析裸名那半用的东西）
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// __LIB__ 由 probe.mjs 打包这个假件时替换成当场那一对包名（每个场景各用各的名字，互不污染）
const LIB_MARKER = '__LIB__/marker.txt';

function safe(fn) {
  try {
    return fn();
  } catch (err) {
    return `ERR ${err.code ?? err.message}`;
  }
}

export const frozen = safe(() => import.meta.resolve(LIB_MARKER));

export function resolveNow() {
  return safe(() => import.meta.resolve(LIB_MARKER));
}

export function requireResolveNow() {
  return safe(() => createRequire(import.meta.url).resolve(LIB_MARKER));
}

export function readUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('file:')) return `ERR not-a-file-url:${url}`;
  return safe(() => readFileSync(fileURLToPath(url), 'utf8').trim());
}

export function readPath(p) {
  return safe(() => readFileSync(p, 'utf8').trim());
}

export function realpathOf(p) {
  return safe(() => realpathSync.native(p));
}
