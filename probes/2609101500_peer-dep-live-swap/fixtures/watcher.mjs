// 长跑进程：起来时 import 一次假件，此后**再也不 import 任何东西**，
// 只按 stdin 的口令打快照。probe.mjs 会把它复制进 home 再从 home 里起，
// 这样裸名解析的起点跟真件一样落在 home 上。
//
// 口令：`snap <标签>` 打一份快照（stdout 一行 `SNAP <json>`）；`quit` 退出。
import { readFileSync, realpathSync, lstatSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const HOME = process.cwd();
// __LIB__ / __PLUGIN__ 由 probe.mjs 复制进 home 时替换成当场那一对包名
const LIB = '__LIB__';
const LIB_DIR = path.join(HOME, 'node_modules', ...LIB.split('/'));
const LIB_MARKER = path.join(LIB_DIR, 'marker.txt');

// 唯一的一次 import，之后模块图再不动
const plugin = await import('__PLUGIN__');

function safe(fn) {
  try {
    return fn();
  } catch (err) {
    return `ERR ${err.code ?? err.message}`;
  }
}

function snap(label) {
  const now = plugin.resolveNow();
  return {
    label,
    // 提议的新形状：每次现拼 <home>/node_modules/<包名>，不经模块解析
    freshPath: {
      marker: safe(() => readFileSync(LIB_MARKER, 'utf8').trim()),
      version: safe(() => JSON.parse(readFileSync(path.join(LIB_DIR, 'package.json'), 'utf8')).version),
      linkType: safe(() => {
        const st = lstatSync(LIB_DIR);
        return st.isSymbolicLink() ? 'symlink/junction' : st.isDirectory() ? 'real-dir' : 'other';
      }),
      linkTarget: safe(() => readlinkSync(LIB_DIR)),
      realpath: safe(() => realpathSync.native(LIB_DIR)),
    },
    // 今天件的做法：首次解析出来的 URL 攥着不放
    frozenResolve: {
      url: plugin.frozen,
      read: plugin.readUrl(plugin.frozen),
    },
    // 同一个进程里再算一次 import.meta.resolve
    resolveNow: {
      url: now,
      read: plugin.readUrl(now),
      sameAsFrozen: now === plugin.frozen,
    },
    requireResolveNow: {
      path: plugin.requireResolveNow(),
      read: plugin.readPath(plugin.requireResolveNow()),
    },
  };
}

process.stdout.write(`READY ${JSON.stringify({ home: HOME, libDir: LIB_DIR })}\n`);

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (cmd === 'snap') {
    process.stdout.write(`SNAP ${JSON.stringify(snap(rest.join(' ') || 'snap'))}\n`);
  } else if (cmd === 'quit') {
    process.exit(0);
  }
});
