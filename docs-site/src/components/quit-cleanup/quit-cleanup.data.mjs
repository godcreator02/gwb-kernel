/**
 * 「退出时等不等得到插件的清理」的讲解数据：画面（quit-cleanup.tsx）与机读版规则（quit-cleanup.ai.mjs）都只读这一份。
 * 每种情况画在同一根 0–6 秒的时间轴上：三条横道是内核、插件的清理、插件起的子进程，竖线是内核调用 app.quit() 的时刻。
 * 时长是示意，只有 5 秒这个上限来自源码；日志行照抄 main.ts 里写的原文。
 */

/** 时间轴的长度，秒 */
export const axisSeconds = 6;

/* ref file="../apps/desktop/src/main.ts" lines="43-43" hash="67d0b4ebe032" blob="b613d37fa683" */
export const cleanupTimeoutSeconds = 5;

/** 三条横道 */
export const lanes = [
  { id: 'kernel', name: '内核', role: 'blue' },
  { id: 'plugin', name: '插件的清理', role: 'slate' },
  { id: 'child', name: '插件起的子进程', role: 'slate' },
];

/**
 * @typedef {{ lane: string, from: number, to: number, tone: 'info' | 'good' | 'warn' | 'bad', label: string }} Bar
 * @typedef {{ id: string, label: string, text: string, bars: Bar[], quitAt: number, log: string[] }} QuitCase
 * @type {QuitCase[]}
 */
/* ref file="../apps/desktop/src/main.ts" lines="379-402" hash="a8eb09335cb7" blob="b613d37fa683" */
export const cases = [
  {
    id: 'returned',
    label: '插件把清理的 promise 返回出来',
    text:
      '所有窗口关闭，第一次进入 will-quit：内核拦下退出，先停掉挂载日志，再 dispose() 整棵插件树、await() 等嵌套的异步清理。插件在 effect 的清理函数里返回结束子进程的 promise，' +
      '内核等到它完成，写一行「清理完成，退出」再 app.quit()；这一次再进入 will-quit 直接放行。子进程在主进程退出之前就结束了。',
    bars: [
      { lane: 'kernel', from: 0, to: 0.8, tone: 'info', label: 'dispose() → await()' },
      { lane: 'plugin', from: 0, to: 0.8, tone: 'good', label: '结束子进程' },
      { lane: 'child', from: 0, to: 0.7, tone: 'good', label: '已结束' },
    ],
    quitAt: 0.8,
    log: ['info kernel 清理完成，退出'],
  },
  {
    id: 'void',
    label: '插件的清理不返回 promise',
    text:
      '插件的清理函数启动了结束子进程的操作却返回 void：cordis 沿链等的是一个立即完成的值，内核的 await() 马上就回来，内核随即 app.quit()。' +
      '日志里一切正常，子进程却还在运行，成了孤儿进程，继续占着端口。等到清理结束要内核与插件都做到：内核 dispose() 之后 await()，插件把清理的 promise 返回出来。',
    bars: [
      { lane: 'kernel', from: 0, to: 0.05, tone: 'info', label: 'await() 马上回来' },
      { lane: 'plugin', from: 0, to: 1.2, tone: 'warn', label: '没人等' },
      { lane: 'child', from: 0, to: 6, tone: 'bad', label: '还在运行（孤儿进程）' },
    ],
    quitAt: 0.05,
    log: ['info kernel 清理完成，退出'],
  },
  {
    id: 'stuck',
    label: '某个插件的清理卡住',
    text:
      '内核的等待与一个 5 秒的定时器赛跑：清理卡住时，到 5 秒就不再等它，照样写「清理完成，退出」、app.quit()。工作台不能因为一个插件关不掉；没清理干净的，这个插件的子进程可能留下。',
    bars: [
      { lane: 'kernel', from: 0, to: 5, tone: 'warn', label: '最多等 5 秒' },
      { lane: 'plugin', from: 0, to: 6, tone: 'bad', label: '卡住' },
      { lane: 'child', from: 0, to: 6, tone: 'bad', label: '可能留下' },
    ],
    quitAt: 5,
    log: ['info kernel 清理完成，退出'],
  },
  {
    id: 'threw',
    label: '清理中抛出错误',
    text: '卸载插件树时抛出的错误被接住，只写一行 warn，然后照常写「清理完成，退出」、app.quit()。',
    bars: [
      { lane: 'kernel', from: 0, to: 0.4, tone: 'info', label: 'dispose() → await()' },
      { lane: 'plugin', from: 0, to: 0.4, tone: 'bad', label: '抛错' },
    ],
    quitAt: 0.4,
    log: ['warn kernel 退出时清理出错：Error: …', 'info kernel 清理完成，退出'],
  },
  {
    id: 'early',
    label: 'loader 还没加载就退出',
    text: '刚启动、loader 还没注册就关掉窗口：没有要卸载的插件树，will-quit 不拦，直接退出，不写清理那一行。',
    bars: [],
    quitAt: 0,
    log: [],
  },
];
