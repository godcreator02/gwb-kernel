// 量「给 import 的 URL 加戳强制重载 ESM 模块」这条路的代价。
// 零依赖，只用 Node 内置。必须带 --expose-gc 起，否则第一步就退出。
//
//   node --expose-gc probe.mjs [重载次数] [runs 里的文件标签]
//
// 四个小节各回答一个问题，见 README。全部输出既打屏也落 runs/<序号>-<标签>.txt。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as nodeModule from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(HERE, 'runs');
const N = Number(process.argv[2] ?? 60);
const LABEL = process.argv[3] ?? 'baseline';
const WARMUP = Math.min(10, Math.floor(N / 4));

const lines = [];
function say(s = '') {
  lines.push(s);
  process.stdout.write(s + '\n');
}

if (typeof globalThis.gc !== 'function') {
  process.stderr.write('拿不到 global.gc：用 node --expose-gc probe.mjs 起。\n');
  process.exit(2);
}

function gcHard() {
  // 三趟。一趟 major GC 不一定把上一趟刚变垃圾的东西全收掉。
  globalThis.gc();
  globalThis.gc();
  globalThis.gc();
}

const fixtureUrl = (name) => pathToFileURL(path.join(HERE, 'fixtures', name)).href;

// 「模块本身」那笔钱跟源码大小成不成正比？拿两个只有注释在撑体积的假件试。
// 只有注释：不多造一个对象，量到的就是源码文本与编译产物那一份。
// 内容确定可复现，缺了就现生成一份（生成物一并入库，目录才是字面意义上的自包含）。
function ensureBulky(kib) {
  const name = `bulky-${kib}k.mjs`;
  const file = path.join(HERE, 'fixtures', name);
  if (!existsSync(file)) {
    const head =
      '// 由 probe.mjs 生成：只有注释在撑体积，模块作用域跟 light.mjs 一模一样。\n' +
      "export const loadId = new URL(import.meta.url).searchParams.get('v') ?? 'noversion';\n" +
      'export function touch() { return loadId; }\n';
    const parts = [head];
    let size = head.length;
    for (let i = 0; size < kib * 1024; i += 1) {
      const line = `// filler ${String(i).padStart(6, '0')} ${'x'.repeat(60)}\n`;
      parts.push(line);
      size += line.length;
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, parts.join(''), 'utf8');
  }
  return name;
}

const kib = (bytes) => (bytes / 1024).toFixed(1) + ' KiB';
const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MiB';

// 最小二乘斜率：samples 是「第 i 次重载之后的 heapUsed」，返回每次重载的字节增量。
function slope(samples, from) {
  const xs = [];
  const ys = [];
  for (let i = from; i < samples.length; i += 1) {
    xs.push(i);
    ys.push(samples[i]);
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const k = num / den;
  const b = my - k * mx;
  // R²：斜率可不可信全看这个，散点乱成一团时 k 没有意义。
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    ssRes += (ys[i] - (k * xs[i] + b)) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return { k, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot, n };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------------------------------------------- 一、净泄漏

// stamped=false 时每次 import 的是同一个 URL，Node 直接命中缓存 —— 这条是噪音底线。
async function measure(fixture, { stamped }) {
  const base = fixtureUrl(fixture);
  const samples = [];
  const refs = [];
  gcHard();
  const before = process.memoryUsage();
  for (let i = 0; i < N; i += 1) {
    const url = stamped ? `${base}?v=${i}` : base;
    const ns = await import(url);
    ns.touch();
    refs.push(new WeakRef(ns));
    gcHard();
    samples.push(process.memoryUsage().heapUsed);
  }
  gcHard();
  const after = process.memoryUsage();
  const diffs = [];
  for (let i = WARMUP + 1; i < samples.length; i += 1) diffs.push(samples[i] - samples[i - 1]);
  // 不带戳时 60 个 WeakRef 指的是同一个对象，所以还要数「去重之后有几个」——
  // 这一栏才是「模块图里到底攥着几份」的证据。
  const alive = refs.filter((r) => r.deref() !== undefined).length;
  const distinctAlive = new Set(refs.map((r) => r.deref()).filter((v) => v !== undefined)).size;
  return {
    fixture,
    stamped,
    samples,
    fit: slope(samples, WARMUP),
    medianDiff: median(diffs),
    heapTotalDelta: after.heapTotal - before.heapTotal,
    rssDelta: after.rss - before.rss,
    externalDelta: after.external - before.external,
    alive,
    distinctAlive,
    total: refs.length,
  };
}

function report(r) {
  const tag = `${r.fixture}${r.stamped ? ' 带戳' : ' 不带戳（对照）'}`;
  say(`  ${tag}`);
  say(`    最小二乘斜率      ${kib(r.fit.k)}/次   (R²=${r.fit.r2.toFixed(4)}, 取样 ${r.fit.n} 点)`);
  say(`    相邻差值中位数    ${kib(r.medianDiff)}/次`);
  say(`    heapUsed 首→尾    ${mib(r.samples[0])} → ${mib(r.samples[r.samples.length - 1])}`);
  say(`    heapTotal 增量    ${mib(r.heapTotalDelta)}`);
  say(`    rss 增量          ${mib(r.rssDelta)}`);
  say(`    external 增量     ${kib(r.externalDelta)}`);
  say(`    命名空间对象存活  ${r.alive}/${r.total}，去重后 ${r.distinctAlive} 份（GC 之后 WeakRef 还 deref 得到的）`);
  say();
}

// ---------------------------------------------------------------- 四、副作用

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sideEffects() {
  const base = fixtureUrl('ticker.mjs');

  // 第一幕：只加戳重载，谁都不 dispose。
  globalThis.__probeTicks = new Map();
  const noDispose = [];
  for (const v of ['A1', 'A2', 'A3']) {
    noDispose.push(await import(`${base}?v=${v}`));
    await sleep(60);
  }
  await sleep(200);
  const actA = Object.fromEntries(globalThis.__probeTicks);
  const snapA = { ...actA };
  await sleep(200);
  const stillA = Object.fromEntries(
    [...globalThis.__probeTicks].map(([k, v]) => [k, v - snapA[k]]),
  );
  for (const m of noDispose) m.dispose();

  // 第二幕：每次重载之前先 dispose 上一个。
  globalThis.__probeTicks = new Map();
  let prev = null;
  for (const v of ['B1', 'B2', 'B3']) {
    if (prev) prev.dispose();
    prev = await import(`${base}?v=${v}`);
    await sleep(60);
  }
  await sleep(200);
  const snapB = Object.fromEntries(globalThis.__probeTicks);
  await sleep(200);
  const stillB = Object.fromEntries(
    [...globalThis.__probeTicks].map(([k, v]) => [k, v - snapB[k]]),
  );
  prev.dispose();

  return { actA, stillA, snapB, stillB };
}

// ---------------------------------------------------------------- 五、有没有口子

function apiSurvey() {
  const keys = Object.keys(nodeModule).sort();
  const suspicious = keys.filter((k) => /cache|clear|delete|invalidat|flush|purge|unload|reset/i.test(k));

  // CJS 的 require.cache 到底管不管 ESM：先 import 过 fixtures/light.mjs，再看它在不在表里。
  const require = createRequire(import.meta.url);
  const lightPath = path.join(HERE, 'fixtures', 'light.mjs');
  const inCjsCache = Object.keys(require.cache).some((k) => k.toLowerCase() === lightPath.toLowerCase());

  // vm.SourceTextModule：另一条路（自己当 linker，没有全局注册表）。不带旗子应该拿不到。
  const vmProbe = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', '-e', `
      const vm = require('node:vm');
      const src = 'export const t = Date.now(); export const mark = Math.random();';
      (async () => {
        const mk = async () => {
          const m = new vm.SourceTextModule(src, { context: vm.createContext({}) });
          await m.link(() => { throw new Error('no imports'); });
          await m.evaluate();
          return m.namespace.mark;
        };
        const a = await mk();
        const b = await mk();
        console.log(JSON.stringify({ ok: true, distinct: a !== b }));
      })().catch((e) => console.log(JSON.stringify({ ok: false, err: String(e && e.message) })));
    `],
    { encoding: 'utf8' },
  );

  const vmNoFlag = spawnSync(
    process.execPath,
    ['-e', 'console.log(JSON.stringify({ hasSourceTextModule: typeof require("node:vm").SourceTextModule }))'],
    { encoding: 'utf8' },
  );

  const mockProbe = spawnSync(
    process.execPath,
    ['--experimental-test-module-mocks', '-e',
      'const t = require("node:test"); console.log(JSON.stringify({ mockModule: typeof t.mock.module, restoreAll: typeof t.mock.restoreAll }))'],
    { encoding: 'utf8' },
  );

  return {
    keys,
    suspicious,
    inCjsCache,
    vmWithFlag: (vmProbe.stdout || vmProbe.stderr || '').trim(),
    vmNoFlag: (vmNoFlag.stdout || vmNoFlag.stderr || '').trim(),
    mockProbe: (mockProbe.stdout || mockProbe.stderr || '').trim(),
  };
}

// ---------------------------------------------------------------- 主流程

say('# ESM 加戳重载的代价');
say();
say(`Node        ${process.version}  ${process.platform}/${process.arch}`);
say(`跑的时刻    ${new Date().toISOString()}`);
say(`重载次数    ${N}（前 ${WARMUP} 次当热身，斜率从第 ${WARMUP} 次起算）`);
say();

say('## 一 / 二、每次重载净泄漏多少，泄漏由什么构成');
say();
const results = [];
results.push(await measure('light.mjs', { stamped: false }));
results.push(await measure('light.mjs', { stamped: true }));
results.push(await measure('heavy.mjs', { stamped: false }));
results.push(await measure('heavy.mjs', { stamped: true }));
for (const r of results) report(r);

const lightK = results[1].fit.k;
const heavyK = results[3].fit.k;
const floorK = Math.max(Math.abs(results[0].fit.k), Math.abs(results[2].fit.k));
say(`  噪音底线（不带戳那两条的斜率绝对值取大）  ${kib(floorK)}/次`);
say(`  模块本身（light 带戳）                     ${kib(lightK)}/次`);
say(`  模块 + 1 MiB 闭包载荷（heavy 带戳）        ${kib(heavyK)}/次`);
say(`  两者之差 ≈ 闭包持有的东西                  ${kib(heavyK - lightK)}/次（假模块里放的是 1024.0 KiB）`);
say();

say('  「模块本身」那笔钱跟源码大小的关系（只有注释在撑体积的假件）：');
const bulky = [];
for (const size of [16, 64]) {
  const r = await measure(ensureBulky(size), { stamped: true });
  bulky.push({ size, r });
  say(
    `    源码 ${String(size).padStart(4)} KiB   斜率 ${kib(r.fit.k)}/次` +
      `   (R²=${r.fit.r2.toFixed(4)})   去重存活 ${r.distinctAlive}/${r.total}`,
  );
}
say(`    源码 ${String(0).padStart(4)} KiB（light，0.2 KiB 源码）   斜率 ${kib(lightK)}/次`);
const bigger = bulky[bulky.length - 1];
say(
  `    斜率/源码大小：${(bigger.r.fit.k / (bigger.size * 1024)).toFixed(2)} 倍` +
    `（1 倍就是「源码有多大，每次就漏多大」）`,
);
say();

say('## 三、旧模块的副作用清得掉吗');
say();
const se = await sideEffects();
say('  第一幕 只加戳、不 dispose：');
say(`    重载三次之后各自的累计 tick   ${JSON.stringify(se.actA)}`);
say(`    再等 200ms，各自新增的 tick   ${JSON.stringify(se.stillA)}`);
say(`    还在跳的旧模块个数            ${Object.entries(se.stillA).filter(([k, v]) => v > 0 && k !== 'A3').length}`);
say();
say('  第二幕 每次重载前先 dispose 上一个：');
say(`    重载三次之后各自的累计 tick   ${JSON.stringify(se.snapB)}`);
say(`    再等 200ms，各自新增的 tick   ${JSON.stringify(se.stillB)}`);
say(`    还在跳的旧模块个数            ${Object.entries(se.stillB).filter(([k, v]) => v > 0 && k !== 'B3').length}`);
say();

say('## 四、Node 有没有清除 ESM 模块图的口子');
say();
const api = apiSurvey();
say(`  node:module 的导出（${api.keys.length} 个）：`);
say('    ' + api.keys.join(' '));
say(`  名字里带 cache/clear/delete/invalidate/flush/purge/unload/reset 的：`);
say('    ' + (api.suspicious.join(' ') || '（无）'));
say(`  import 过的 .mjs 出现在 require.cache 里吗   ${api.inCjsCache ? '是' : '否'}`);
say(`  不带旗子时 vm.SourceTextModule               ${api.vmNoFlag}`);
say(`  带 --experimental-vm-modules 连造两个实例    ${api.vmWithFlag}`);
say(`  --experimental-test-module-mocks 的 mock     ${api.mockProbe}`);
say();

// 落盘
mkdirSync(RUNS, { recursive: true });
const used = readdirSync(RUNS)
  .map((f) => Number(/^(\d+)-/.exec(f)?.[1]))
  .filter((n) => Number.isFinite(n));
const seq = String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0');
const outFile = path.join(RUNS, `${seq}-${LABEL}.txt`);
writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
process.stdout.write(`\n落盘：${path.relative(HERE, outFile).replace(/\\/g, '/')}\n`);
