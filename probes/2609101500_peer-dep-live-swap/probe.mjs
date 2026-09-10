// 量「把独立分发的包从 dependencies 降成 peerDependencies、件改成现查
// <home>/node_modules/<包名>」这条路在本机 pnpm 上成不成立。
//
// 零依赖，只用 Node 内置的东西；外部只依赖本机 Verdaccio（127.0.0.1:4873）。
// 每个场景用自己的一对假包名（`-a` `-b` …），所以场景之间在 registry 上互不污染。
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');
const RUNS = path.join(HERE, 'runs');
const WORK = path.join(os.tmpdir(), 'gwb-probe-peer', 'work');
const REGISTRY = 'http://127.0.0.1:4873/';
// 只有 @godcreator02 这个 scope 在本机 registry 上允许 publish/unpublish
// （见 D:\unitfolders\26090520zzv\registry\config.yaml），所以假包只能叫这个 scope。
const SCOPE = '@godcreator02';
const KEEP = process.argv.includes('--keep');
const LABEL = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'run';

let transcript = '';
function say(s = '') {
  const line = String(s);
  transcript += line + '\n';
  process.stdout.write(line + '\n');
}
function head(s) {
  say('');
  say('='.repeat(78));
  say(s);
  say('='.repeat(78));
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: true, ...opts });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\r\n/g, '\n').trim() };
}
function shSay(cmd, args, opts = {}) {
  const r = sh(cmd, args, opts);
  say(`$ ${cmd} ${args.join(' ')}${opts.cwd ? `   (cwd=${short(opts.cwd)})` : ''}`);
  say(r.out ? r.out.split('\n').map((l) => `  | ${l}`).join('\n') : '  | (无输出)');
  say(`  → exit ${r.code}`);
  say('');
  return r;
}
// 路径太长会把表格撑爆，统一砍掉工作目录前缀
function short(p) {
  return String(p).replace(WORK, '<work>').replace(/^file:\/\/\//, '').replace(WORK.replace(/\\/g, '/'), '<work>');
}

// ------------------------------------------------------------------ 造假包
function writePkg(dir, files) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const p = path.join(dir, name);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
}

function stageLib(lib, version, marker) {
  const dir = path.join(WORK, `stage-${lib.split('/')[1]}-${version}`);
  writePkg(dir, {
    'package.json': JSON.stringify(
      { name: lib, version, type: 'module', main: 'index.mjs', files: ['index.mjs', 'marker.txt'] },
      null,
      2,
    ),
    'index.mjs': readFileSync(path.join(FIXTURES, 'lib', 'index.mjs'), 'utf8').replace('__VERSION__', version),
    'marker.txt': marker,
  });
  return dir;
}

// shape: 'peer' → peerDependencies（提议的新形状）；'deps' → dependencies（今天的形状）
function stagePlugin(plugin, lib, version, shape) {
  const dir = path.join(WORK, `stage-${plugin.split('/')[1]}-${version}`);
  const field = shape === 'peer' ? 'peerDependencies' : 'dependencies';
  writePkg(dir, {
    'package.json': JSON.stringify(
      {
        name: plugin,
        version,
        type: 'module',
        main: 'index.mjs',
        exports: { '.': './index.mjs' },
        files: ['index.mjs'],
        [field]: { [lib]: '^0.1.0' },
      },
      null,
      2,
    ),
    'index.mjs': readFileSync(path.join(FIXTURES, 'plugin', 'index.mjs'), 'utf8').replaceAll('__LIB__', lib),
  });
  return dir;
}

const publish = (dir) => shSay('pnpm', ['publish', '--registry', REGISTRY, '--no-git-checks'], { cwd: dir });
const unpublish = (name) =>
  sh('pnpm', ['unpublish', name, '--force', '--registry', REGISTRY], { cwd: WORK });

// ------------------------------------------------------------------ 看现场
function inspectHome(home, lib, plugin, tag) {
  const libDir = path.join(home, 'node_modules', ...lib.split('/'));
  say(`--- 磁盘现场 [${tag}] ---`);
  say(`  home/package.json  ${readFileSync(path.join(home, 'package.json'), 'utf8').replace(/\s+/g, ' ')}`);
  say(`  <home>/node_modules/${lib} 存在？ ${existsSync(libDir)}`);
  if (existsSync(libDir)) {
    const st = lstatSync(libDir);
    say(`    形态       ${st.isSymbolicLink() ? 'symlink/junction' : st.isDirectory() ? '实目录' : '其他'}`);
    say(`    readlink   ${short(tryIt(() => readlinkSync(libDir)))}`);
    say(`    marker.txt ${tryIt(() => readFileSync(path.join(libDir, 'marker.txt'), 'utf8').trim())}`);
    say(`    version    ${tryIt(() => JSON.parse(readFileSync(path.join(libDir, 'package.json'), 'utf8')).version)}`);
  }
  const pnpmDir = path.join(home, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    // 注意 pnpm 会把过长的目录名截断成 `@godcreator02+probe-peer-pl_<hash>`，
    // 所以这里按公共前缀 probe-peer 筛，别按整个包名筛
    const dirs = readdirSync(pnpmDir).filter((d) => d.includes('probe-peer'));
    say(`  .pnpm/ 里的相关目录  ${dirs.join(', ') || '(无)'}`);
    const libId = `+${lib.split('/')[1]}@`;
    // 件自己那个私有 node_modules 里的链接——它跟 home 根上那条是两码事
    for (const d of dirs.filter((d) => !d.includes(libId))) {
      const nm = path.join(pnpmDir, d, 'node_modules');
      const priv = path.join(nm, ...lib.split('/'));
      say(
        `    件私有 ${d}/node_modules/ 里有: ${tryIt(() => readdirSync(path.join(nm, SCOPE)).join(', '))}`,
      );
      say(
        `      其中 ${lib}: ` +
          (existsSync(priv)
            ? `marker=${tryIt(() => readFileSync(path.join(priv, 'marker.txt'), 'utf8').trim())} → ${short(tryIt(() => readlinkSync(priv)))}`
            : '(不存在)'),
      );
    }
  }
  const lock = path.join(home, 'pnpm-lock.yaml');
  if (existsSync(lock)) {
    const lines = readFileSync(lock, 'utf8').split('\n');
    const i = lines.findIndex((l) => l.trim() === 'importers:');
    const j = lines.findIndex((l, k) => k > i && l.trim() === 'packages:');
    say('  锁文件 importers 段:');
    say(lines.slice(i, j < 0 ? i + 16 : j).map((l) => `    | ${l}`).join('\n'));
  }
  say('');
}
function tryIt(fn) {
  try {
    return fn();
  } catch (err) {
    return `ERR ${err.code ?? err.message}`;
  }
}

// ------------------------------------------------------------------ 长跑进程
function startWatcher(home, lib, plugin) {
  const src = readFileSync(path.join(FIXTURES, 'watcher.mjs'), 'utf8')
    .replaceAll('__LIB__', lib)
    .replaceAll('__PLUGIN__', plugin);
  writeFileSync(path.join(home, 'probe-watcher.mjs'), src);
  const child = spawn(process.execPath, ['probe-watcher.mjs'], { cwd: home, stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const waiters = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) waiters.shift()?.(line);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => say(`  [watcher stderr] ${String(d).trim()}`));
  const next = () => new Promise((res) => waiters.push(res));
  return {
    ready: next(),
    snap(label) {
      const p = next();
      child.stdin.write(`snap ${label}\n`);
      return p;
    },
    quit() {
      child.stdin.write('quit\n');
    },
  };
}

// 每个动作之后新起一个进程算一次，拿到「此刻磁盘上 Node 会解析成什么」的地面真相
function oneshot(home, lib, plugin) {
  const r = sh(`"${process.execPath}"`, ['probe-oneshot.mjs', lib, plugin], { cwd: home, shell: true });
  try {
    return JSON.parse(r.out.split('\n').filter(Boolean).at(-1));
  } catch {
    return { url: `ERR 新进程挂了`, read: r.out.split('\n').at(-1) ?? '', require: '' };
  }
}

function showSnap(line, fresh) {
  const s = JSON.parse(line.replace(/^SNAP /, ''));
  say(`--- 长跑进程快照 [${s.label}] ---`);
  say(`  ① 现查 <home>/node_modules/<包名>（提议的新形状）`);
  say(`     marker=${s.freshPath.marker}  version=${s.freshPath.version}  形态=${s.freshPath.linkType}`);
  say(`     链接指向 ${short(s.freshPath.linkTarget)}`);
  say(`  ② 攥着首次 import.meta.resolve 的 URL（今天件的做法）`);
  say(`     读出来=${s.frozenResolve.read}   url=${short(s.frozenResolve.url)}`);
  say(`  ③ 同一个进程里再算一次 import.meta.resolve`);
  say(`     读出来=${s.resolveNow.read}   跟首次同一个 URL？${s.resolveNow.sameAsFrozen}`);
  say(`  ④ 同一个进程里再算一次 createRequire().resolve`);
  say(`     读出来=${s.requireResolveNow.read}`);
  say(`  ⑤ 新起一个进程算 import.meta.resolve（磁盘地面真相）`);
  say(`     读出来=${fresh.read}   url=${short(fresh.url)}`);
  say('');
  return { s, fresh };
}

// ------------------------------------------------------------------ 一场实验
async function scenario(cfg) {
  const { key, name, shape, npmrcExtra = [], workspaceYaml, install, upgradeSteps, note } = cfg;
  const lib = `${SCOPE}/probe-peer-lib-${key}`;
  const plugin = `${SCOPE}/probe-peer-plugin-${key}`;

  head(`场景 ${key}：${name}`);
  if (note) say(note), say('');
  say(`假库 ${lib}   0.1.0(marker=old) / 0.1.1(marker=new)`);
  say(`假件 ${plugin} 0.1.0，把库写在 ${shape === 'peer' ? 'peerDependencies' : 'dependencies'}，从不 import 它的代码`);
  say('');

  unpublish(lib);
  unpublish(plugin);
  publish(stageLib(lib, '0.1.0', 'old'));
  publish(stagePlugin(plugin, lib, '0.1.0', shape));

  const home = path.join(WORK, `home-${key}`);
  rmSync(home, { recursive: true, force: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(path.join(home, 'package.json'), JSON.stringify({ name: 'gwb-home', private: true }, null, 2));
  writeFileSync(path.join(home, '.npmrc'), [`${SCOPE}:registry=${REGISTRY}`, ...npmrcExtra].join('\n') + '\n');
  if (workspaceYaml) writeFileSync(path.join(home, 'pnpm-workspace.yaml'), workspaceYaml);
  writeFileSync(
    path.join(home, 'probe-oneshot.mjs'),
    readFileSync(path.join(FIXTURES, 'oneshot.mjs'), 'utf8'),
  );
  say(`home = ${short(home)}`);
  say(`home/.npmrc            ${readFileSync(path.join(home, '.npmrc'), 'utf8').trim().split('\n').join(' ; ')}`);
  say(`home/pnpm-workspace.yaml ${workspaceYaml ? workspaceYaml.trim().split('\n').join(' ; ') : '(没有)'}`);
  say('');

  for (const step of install) shSay('pnpm', step, { cwd: home });
  inspectHome(home, lib, plugin, `${key} 装完（registry 上此刻只有 lib 0.1.0）`);

  const w = startWatcher(home, lib, plugin);
  say(`长跑进程起来了: ${short(await w.ready)}`);
  say('');
  const rows = [];
  rows.push(row('（升级前）', ...Object.values(showSnap(await w.snap('升级前'), oneshot(home, lib, plugin)))));

  head(`场景 ${key} · 假库发 0.1.1（marker=new）——长跑进程此刻还活着，没退过`);
  publish(stageLib(lib, '0.1.1', 'new'));

  for (const step of upgradeSteps) {
    head(`场景 ${key} · 升级动作 ${step.length ? `pnpm ${step.join(' ')}` : '(无)'}`);
    shSay('pnpm', step, { cwd: home });
    inspectHome(home, lib, plugin, `${key} 跑完 pnpm ${step.join(' ')}`);
    const r = showSnap(await w.snap(`pnpm ${step.join(' ')} 之后`), oneshot(home, lib, plugin));
    rows.push(row(`pnpm ${step.join(' ')}`, r.s, r.fresh));
  }
  w.quit();

  head(`场景 ${key} 汇总`);
  printTable(rows);
  return { key, name, rows };
}

function row(step, s, fresh) {
  return {
    step,
    fresh: `${s.freshPath.marker}${s.freshPath.version?.startsWith?.('ERR') ? '' : ` (v${s.freshPath.version})`}`,
    frozen: s.frozenResolve.read,
    now: s.resolveNow.read,
    same: s.resolveNow.sameAsFrozen ? '是' : '否',
    disk: fresh.read,
  };
}
function printTable(rows) {
  say('| 动作 | ① 现查路径 | ② 攥着的 URL | ③ 同进程再 resolve | ③=① 首次？ | ⑤ 新进程 resolve |');
  say('| --- | --- | --- | --- | --- | --- |');
  for (const r of rows) say(`| ${r.step} | ${r.fresh} | ${r.frozen} | ${r.now} | ${r.same} | ${r.disk} |`);
  say('');
}

// ------------------------------------------------------------------ 主流程
async function main() {
  head('零、环境');
  shSay('pnpm', ['--version']);
  say(`node   ${process.version}`);
  say(`平台   ${process.platform}/${process.arch}`);
  say('');
  shSay('pnpm', ['config', 'get', 'auto-install-peers']);
  shSay('pnpm', ['config', 'list']);
  shSay('npm', ['ping', '--registry', REGISTRY]);
  const userNpmrc = path.join(os.homedir(), '.npmrc');
  say(`用户级 ~/.npmrc (${userNpmrc}) 存在？ ${existsSync(userNpmrc)}`);
  if (existsSync(userNpmrc)) {
    say(
      readFileSync(userNpmrc, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => `  | ${l.includes('_authToken') ? l.replace(/=.*/, '=<抹掉>') : l}`)
        .join('\n'),
    );
  }
  say('');
  say('真 home 里有没有 .npmrc / pnpm-workspace.yaml 覆盖（只读不改）:');
  const homesRoot = path.join(process.env.APPDATA ?? '', 'gwb-kernel', 'homes');
  if (existsSync(homesRoot)) {
    for (const h of readdirSync(homesRoot)) {
      const f = path.join(homesRoot, h, '.npmrc');
      const y = path.join(homesRoot, h, 'pnpm-workspace.yaml');
      say(
        `  ${h.padEnd(26)} .npmrc=${existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').join(' ; ') : '(无)'}` +
          `  pnpm-workspace.yaml=${existsSync(y) ? '有' : '(无)'}`,
      );
    }
  }

  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  writeFileSync(path.join(WORK, 'package.json'), JSON.stringify({ name: 'probe-work', private: true }));
  say('');
  say(`工作目录 = ${WORK}`);

  const all = [];
  all.push(
    await scenario({
      key: 'a',
      name: 'peer + pnpm 默认设置 + 只装件',
      note: '提议的新形状，最省事的那条路：home 里只 pnpm add 那个件，指望 pnpm 把 peer 自动补上。',
      shape: 'peer',
      install: [['add', `${SCOPE}/probe-peer-plugin-a@0.1.0`]],
      upgradeSteps: [['update', `${SCOPE}/probe-peer-lib-a`], ['update'], ['install'], ['add', `${SCOPE}/probe-peer-lib-a@0.1.1`]],
    }),
  );
  all.push(
    await scenario({
      key: 'b',
      name: 'peer + pnpm 默认设置 + 件与库一起装进 home',
      note: '「谁来装」选「装件时顺带把 peer 也装进 home 的直接依赖」那条路。',
      shape: 'peer',
      install: [['add', `${SCOPE}/probe-peer-plugin-b@0.1.0`, `${SCOPE}/probe-peer-lib-b@0.1.0`]],
      upgradeSteps: [['update', `${SCOPE}/probe-peer-lib-b`], ['update'], ['add', `${SCOPE}/probe-peer-lib-b@0.1.1`]],
    }),
  );
  all.push(
    await scenario({
      key: 'c',
      name: '今天的形状：库写在件的 dependencies，只装件',
      note: '对照组。这是此刻线上的样子，用来复现「升级之后件攥着旧真实路径」那个病。',
      shape: 'deps',
      install: [['add', `${SCOPE}/probe-peer-plugin-c@0.1.0`]],
      upgradeSteps: [['update', `${SCOPE}/probe-peer-lib-c`], ['update'], ['install']],
    }),
  );
  all.push(
    await scenario({
      key: 'd',
      name: 'peer + home 的 .npmrc 写 auto-install-peers=false',
      note: 'pnpm 11 还认不认 .npmrc 里这个键？（pnpm 10 起 pnpm 专属设置搬去了 pnpm-workspace.yaml）',
      shape: 'peer',
      npmrcExtra: ['auto-install-peers=false'],
      install: [['add', `${SCOPE}/probe-peer-plugin-d@0.1.0`]],
      upgradeSteps: [['update']],
    }),
  );
  all.push(
    await scenario({
      key: 'e',
      name: 'peer + home 放 pnpm-workspace.yaml 写 autoInstallPeers: false',
      note: '内核仓工作区用的就是这个键。关掉之后 peer 还在不在？',
      shape: 'peer',
      workspaceYaml: 'autoInstallPeers: false\n',
      install: [['add', `${SCOPE}/probe-peer-plugin-e@0.1.0`]],
      upgradeSteps: [['update']],
    }),
  );

  head('九、收尾：把假包从 registry 上清掉');
  for (const k of ['a', 'b', 'c', 'd', 'e']) {
    for (const n of [`${SCOPE}/probe-peer-lib-${k}`, `${SCOPE}/probe-peer-plugin-${k}`]) {
      const r = unpublish(n);
      say(`  unpublish ${n} → exit ${r.code} ${r.out.split('\n').at(-1) ?? ''}`);
    }
  }
  const left = sh('npm', ['search', 'probe-peer', '--registry', REGISTRY, '--json']);
  say('');
  say('registry 上还剩什么（npm search probe-peer）:');
  say(left.out.split('\n').slice(0, 12).map((l) => `  | ${l}`).join('\n'));

  if (!KEEP) {
    rmSync(WORK, { recursive: true, force: true });
    say('');
    say(`工作目录已删: ${WORK}`);
  } else {
    say('');
    say(`--keep：工作目录留着 ${WORK}`);
  }

  head('十、总表');
  for (const s of all) {
    say(`场景 ${s.key}：${s.name}`);
    printTable(s.rows);
  }
}

main()
  .then(() => finish(0))
  .catch((err) => {
    say('');
    say(`!!! 挂了: ${err?.stack ?? err}`);
    finish(1);
  });

function finish(code) {
  mkdirSync(RUNS, { recursive: true });
  const n = readdirSync(RUNS).filter((f) => /^\d\d-/.test(f)).length + 1;
  const file = path.join(RUNS, `${String(n).padStart(2, '0')}-${LABEL}.txt`);
  writeFileSync(file, transcript);
  process.stdout.write(`\n输出已落 ${file}\n`);
  process.exit(code);
}
