/**
 * 「请求通道的几种结局」的讲解数据：画面（request-outcomes.tsx）与机读版规则（request-outcomes.ai.mjs）都只读这一份。
 * 每种情况三栏：页面怎么调用、主进程回了什么（或抛了什么）、页面最后拿到什么；另记处理器有没有被调用。
 * 报错原文照抄 apps/desktop/src/，正上方的记号把它钉在源码上；命令名与回执内容是示例。
 */

/**
 * @typedef {{ id: string, label: string, text: string, call: string, reply: string, replyKind: 'value' | 'throw', page: string, pageKind: 'resolve' | 'reject', handlerRan: boolean }} OutcomeCase
 * @type {OutcomeCase[]}
 */
export const cases = [
  {
    id: 'ok',
    label: '已登记，正常返回',
    text:
      '通道有处理器。主进程把处理器的返回值放进 { available: true, value }，preload 解开后把 value 原样交给页面。页面拿到的就是命令插件自己的回执。',
    call: "window.gwb.request('commands.run', { name: 'shell.panes' })",
    reply: '{ available: true, value: { ok: true, data: [ … ] } }',
    replyKind: 'value',
    page: 'resolve → { ok: true, data: [ … ] }',
    pageKind: 'resolve',
    handlerRan: true,
  },
  {
    id: 'same-field',
    label: '返回值里恰好有 available',
    text:
      '处理器返回 { available: false } 这样的对象，也只是 value 的内容：外层的 available 才是传输状态。页面拿到原样的 { available: false }，内核与 preload 都不解释业务值。',
    call: "window.gwb.request('sample', 42)",
    reply: '{ available: true, value: { available: false } }',
    replyKind: 'value',
    page: 'resolve → { available: false }',
    pageKind: 'resolve',
    handlerRan: true,
  },
  /* ref file="../apps/desktop/src/preload.cjs" lines="40-40" hash="c932e8e824bb" blob="97b2299ef0dc" */
  {
    id: 'unregistered',
    label: '通道没人登记',
    text:
      '提供方没装、还没加载完或已卸载，表里查不到这个通道。主进程回 { available: false }，preload 把它变成一个固定格式的错误，调用方可以按消息认出来。',
    call: "window.gwb.request('commands.run', { name: 'shell.panes' })",
    reply: '{ available: false }',
    replyKind: 'value',
    page: 'reject → Error: GWB_REQUEST_UNAVAILABLE: commands.run',
    pageKind: 'reject',
    handlerRan: false,
  },
  {
    id: 'throws',
    label: '处理器抛错',
    text:
      '处理器同步抛错或返回的 promise 拒绝，主进程的 invoke 处理函数跟着拒绝，Electron 把错误带回页面，request 拒绝。内核不把它换成任何业务回执。',
    call: "window.gwb.request('broken', null)",
    reply: '抛出处理器的错误',
    replyKind: 'throw',
    page: 'reject → 处理器的错误（经 Electron IPC 传回）',
    pageKind: 'reject',
    handlerRan: true,
  },
  /* ref file="../apps/desktop/src/main.ts" lines="287-287" hash="260198c4b1d9" blob="b613d37fa683" */
  {
    id: 'not-top',
    label: '发送方不是顶层框架',
    text:
      '发送方框架已经跳走或销毁时 senderFrame 是 null，iframe 有父框架，这两种都不是顶层框架：主进程直接抛错，处理器不会被调用。window.gwb 本来只注入顶层框架。',
    call: '（发送方框架已销毁）window.gwb.request(…)',
    reply: "throw Error('gwb:request 只接收顶层框架的调用')",
    replyKind: 'throw',
    page: 'reject → gwb:request 只接收顶层框架的调用',
    pageKind: 'reject',
    handlerRan: false,
  },
  /* ref file="../apps/desktop/src/requests.ts" lines="4-4" hash="759795bb79f5" blob="2041dd1920e9" */
  {
    id: 'bad-channel',
    label: '通道名不是非空字符串',
    text: '通道名是空串、全是空白或不是字符串，登记与分发都直接抛错，处理器不会被调用。',
    call: "window.gwb.request('', {})",
    reply: "throw Error('请求通道必须是非空字符串')",
    replyKind: 'throw',
    page: 'reject → 请求通道必须是非空字符串',
    pageKind: 'reject',
    handlerRan: false,
  },
];
