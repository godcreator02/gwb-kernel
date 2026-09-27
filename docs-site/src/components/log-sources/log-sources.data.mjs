/**
 * 「一条日志从哪来、写成什么」的讲解数据：画面（log-sources.tsx）与机读版规则（log-sources.ai.mjs）都只读这一份。
 * 每种情况：谁在什么地方写了一句、经过哪几步、终端上的那一行、gwb.log 里的那一行、会不会触发一次只读状态页的推送。
 * 两种输出格式由下面两个函数按内核的写法算出来，正上方的记号把它们钉在 log-record.ts 上；插件名、正文与时间是示例。
 */

/* ref file="../apps/desktop/src/log-record.ts" lines="13-35" hash="dbcfdf94ca8a" blob="9e005a2aef22" */
const KERNEL_LOGGER_NAMES = new Set(['kernel', 'loader', 'include']);
const RENDERER_LOGGER_NAME = 'renderer';

function sourceOfLoggerName(loggerName) {
  if (loggerName === RENDERER_LOGGER_NAME) return 'renderer';
  return KERNEL_LOGGER_NAMES.has(loggerName) ? 'kernel' : 'plugin';
}

/** gwb.log 里的一行：五个键、顺序固定，行尾一个换行（画面里不显示那个换行） */
export function fileLineOf({ ts, level, name, msg }) {
  return JSON.stringify({ ts, level, source: sourceOfLoggerName(name), name, msg });
}

/** 终端上的一行：「时间 级别 名字 正文」，正文里的换行原样输出 */
export function terminalLineOf({ ts, level, name, msg }) {
  return `${ts} ${level} ${name} ${msg}`;
}

/**
 * @typedef {{ ts: string, level: 'error' | 'warn' | 'info' | 'debug', name: string, msg: string }} Written
 * @typedef {{ id: string, label: string, text: string, call: string, path: string[], record: Written, pushes: boolean }} SourceCase
 * @type {SourceCase[]}
 */
export const cases = [
  {
    id: 'plugin-info',
    label: '插件写一句 info',
    text:
      '插件用 cordis 的 ctx.logger(名字) 写日志。内核注册的 exporter 收到这一条，按 logger 名定来源——不是 kernel、loader、include、renderer 的都算 plugin——然后同时写 stderr 与 gwb.log。',
    call: "ctx.logger('gwb-demo').info('就绪')",
    path: ['ctx.logger', 'exporter', 'writeLogLine', 'stderr + gwb.log'],
    record: { ts: '2026-09-27T14:00:00.000Z', level: 'info', name: 'gwb-demo', msg: '就绪' },
    pushes: false,
  },
  {
    id: 'plugin-error',
    label: '插件写多行 error',
    text:
      '正文里的换行在 gwb.log 里留在 JSON 字符串中，一条记录永远是一行，按行读、按行解析就够了；终端上照原样换行。error 还会让主进程在 200 毫秒后重新推一次只读状态页的数据，没有外壳时人能在窗口里看到这一行。',
    call: "ctx.logger('gwb-demo').error('第一行\\n第二行')",
    path: ['ctx.logger', 'exporter', 'writeLogLine', 'stderr + gwb.log', '推 gwb:shell'],
    record: { ts: '2026-09-27T14:00:01.000Z', level: 'error', name: 'gwb-demo', msg: '第一行\n第二行' },
    pushes: true,
  },
  /* ref file="../apps/desktop/src/main.ts" lines="297-302" hash="e6573ba774b5" blob="b613d37fa683" */
  {
    id: 'renderer',
    label: '页面 console.warn',
    text:
      '页面上任何代码的 console 输出，主进程从窗口的 console-message 事件收到，转成名字 renderer 的 cordis 日志；Electron 的 warning 记成 warn，其余级别照搬。warn 只进日志，不触发推送。',
    call: "console.warn('窗格布局读不回来')",
    path: ['console-message', "ctx.logger('renderer')", 'exporter', 'stderr + gwb.log'],
    record: { ts: '2026-09-27T14:00:02.000Z', level: 'warn', name: 'renderer', msg: '窗格布局读不回来' },
    pushes: false,
  },
  /* ref file="../apps/desktop/src/entry-log.ts" lines="101-103" hash="68f0e3e6ddb6" blob="9c2a0bc85145" */
  {
    id: 'mounted',
    label: '条目加载成功',
    text:
      '内核订阅 cordis 的条目状态变化，每个插件条目进 ACTIVE 时用名字 loader 写一行，带 apply 从 LOADING 到 ACTIVE 的耗时。loader 算内核来源。',
    call: '（内核自己写：条目 home:shell 进入 ACTIVE）',
    path: ['internal/status', "ctx.logger('loader')", 'exporter', 'stderr + gwb.log'],
    record: { ts: '2026-09-27T14:00:03.000Z', level: 'info', name: 'loader', msg: '@godcreator/gwb-shell 挂上了（apply 12 ms）' },
    pushes: false,
  },
  /* ref file="../apps/desktop/src/entry-log.ts" lines="61-67" hash="aa25e5f55ab9" blob="9c2a0bc85145" */
  {
    id: 'summary',
    label: '条目加载完的汇总',
    text:
      '一开始就缺服务的条目不发任何状态事件，只能靠汇总报出来：条目树停止变化 300 毫秒、ctx.loader.await() 返回之后，内核写一行汇总。有挂载失败或没导入成功的是 error，只有在等的是 warn，全部加载成功是 info。这一行是 error 时也触发推送。',
    call: '（内核自己写：条目树安定之后）',
    path: ['loader.await()', 'summarizeEntries', "ctx.logger('loader')", 'stderr + gwb.log', '推 gwb:shell'],
    record: {
      ts: '2026-09-27T14:00:04.000Z',
      level: 'error',
      name: 'loader',
      msg: '条目加载完：2 个挂上；在等：gwb-demo（缺 gwbData）；没导入成功：gwb-typo（原因见 include 的 error）',
    },
    pushes: true,
  },
  /* ref file="../apps/desktop/src/main.ts" lines="186-193" hash="5ee69982453f" blob="b613d37fa683" */
  {
    id: 'unformattable',
    label: '参数格式化不了',
    text:
      '正文由 cordis 自己的 Logger.format 格式化；参数里有循环引用、BigInt 时它会抛。内核接住，退回把每个参数转成字符串、用空格拼起来，这一行照样写进去，写日志的插件不会跟着抛。',
    call: "ctx.logger('gwb-demo').error('带循环引用的错', circular)",
    path: ['ctx.logger', 'exporter', 'Logger.format 抛错 → 逐个 String()', 'stderr + gwb.log', '推 gwb:shell'],
    record: { ts: '2026-09-27T14:00:05.000Z', level: 'error', name: 'gwb-demo', msg: '带循环引用的错 [object Object]' },
    pushes: true,
  },
  /* ref file="../apps/desktop/src/main.ts" lines="105-108" hash="15d5f409766e" blob="b613d37fa683" */
  {
    id: 'before-cordis',
    label: 'cordis 实例建好之前',
    text:
      '单实例锁拿不到、启动失败这几种情况发生在 cordis 实例建好之前（或者要马上退出），内核不经 cordis，直接调用同一个 writeLogLine 写这一行，格式与别的行完全相同。',
    call: '（内核自己写：同一个 home 已有实例在运行）',
    path: ['writeLogLine', 'stderr + gwb.log'],
    record: {
      ts: '2026-09-27T14:00:06.000Z',
      level: 'error',
      name: 'kernel',
      msg: 'home C:\\Users\\me\\AppData\\Roaming\\gwb-kernel\\homes\\demo 已有实例在运行，本实例退出',
    },
    pushes: false,
  },
];
