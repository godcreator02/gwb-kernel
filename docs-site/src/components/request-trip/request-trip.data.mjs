/**
 * 「一条请求从页面到插件再回来」的讲解数据：画面（request-trip.tsx）与机读版规则（request-trip.ai.mjs）都只读这一份。
 * 例子是页面上的外壳用命令插件的页面客户端调命令 shell.panes：命令插件登记了请求通道 commands.run，内核只按通道名转交。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、对应哪段源码。源码片段照抄 apps/desktop/，正上方的记号把它钉在源码上。
 */

/**
 * 参与者：页面上的代码琥珀色，preload 紫色，内核主进程蓝色，登记通道的命令插件绿色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/explainer-player').Role }[]}
 */
export const actors = [
  { id: 'client', name: '页面上的代码', sub: '命令插件的页面客户端', role: 'amber' },
  { id: 'gwb', name: 'window.gwb.request', sub: 'preload.cjs', role: 'violet' },
  { id: 'ipc', name: "ipcMain.handle", sub: "'gwb:request'", role: 'blue' },
  { id: 'requests', name: '请求通道表', sub: 'requests.ts', role: 'blue' },
  { id: 'commands', name: '命令插件', sub: "通道 'commands.run'", role: 'emerald' },
];

/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} TripStep
 * @type {TripStep[]}
 */
export const steps = [
  /* ref file="../apps/desktop/src/requests.ts" lines="13-24" hash="7bec13ecbc2c" blob="2041dd1920e9" */
  {
    title: '插件登记通道',
    text:
      "命令插件初始化时调用 ctx.gwbKernel.handleRequest('commands.run', handler)，把返回的注销函数交给 ctx.effect。" +
      '内核的请求通道表里多了一条「commands.run → 处理器」。同名通道已经登记过就直接抛错；注销函数只生效一次，插件卸载时由 cordis 调用。',
    lit: ['commands', 'requests'],
    shown: ['register'],
    marks: { requests: 'commands.run → 处理器' },
    code: {
      file: 'apps/desktop/src/requests.ts',
      start: 13,
      lines: [
        '    handle(channel: string, handler: GwbRequestHandler): () => void {',
        '      checkChannel(channel)',
        "      if (typeof handler !== 'function') throw new Error('请求处理器必须是函数')",
        '      if (handlers.has(channel)) throw new Error(`请求通道已登记：${channel}`)',
        '      handlers.set(channel, handler)',
        '      let revoked = false',
        '      return () => {',
        '        if (revoked) return',
        '        revoked = true',
        '        handlers.delete(channel)',
        '      }',
        '    },',
      ],
      highlight: [16, 17],
    },
  },
  /* ref file="../apps/desktop/src/api.ts" lines="35-36" hash="ea536938b1a8" blob="b2cf0ae6f72c" */
  {
    title: '页面发请求',
    text:
      "外壳调用命令插件的页面客户端 command('shell.panes')，客户端再调用 window.gwb.request('commands.run', { name, args })。" +
      '通道名 commands.run、载荷里的 name 与 args、回执 GwbResult 的形状都是命令插件定的；对内核来说，通道名只是一个字符串，载荷只是 unknown。',
    lit: ['client', 'gwb'],
    shown: ['call'],
    marks: {},
    code: {
      file: 'apps/desktop/src/api.ts',
      start: 35,
      lines: [
        '  /** 发送请求；通道未登记时以 GWB_REQUEST_UNAVAILABLE: <channel> 拒绝，其他传输与处理器错误照常拒绝。 */',
        '  request(channel: string, payload?: unknown): Promise<unknown>',
      ],
    },
  },
  /* ref file="../apps/desktop/src/preload.cjs" lines="38-42" hash="acee284069bd" blob="97b2299ef0dc" */
  {
    title: '跨进程：ipcRenderer.invoke',
    text:
      'preload 把通道名与载荷原样交给 Electron 的 IPC 通道 gwb:request。载荷经结构化克隆传到主进程，函数、DOM 节点传不过去。' +
      '页面上只有这个 window.gwb，没有 ipcRenderer，也没有 Node。',
    lit: ['gwb', 'ipc'],
    shown: ['invoke'],
    marks: { gwb: '结构化克隆' },
    code: {
      file: 'apps/desktop/src/preload.cjs',
      start: 38,
      lines: [
        '  request: async (channel, payload) => {',
        "    const reply = await ipcRenderer.invoke('gwb:request', channel, payload)",
        '    if (!reply.available) throw new Error(`GWB_REQUEST_UNAVAILABLE: ${channel}`)',
        '    return reply.value',
        '  },',
      ],
      highlight: [39, 39],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="286-289" hash="95573aa880ff" blob="b613d37fa683" */
  {
    title: '只收顶层框架，按通道名找处理器',
    text:
      '主进程先看发送方：发送方框架是 iframe，或已经跳走、销毁（senderFrame 是 null），直接拒绝，处理器不会被调用。' +
      '通过之后按通道名查表；通道名不是非空字符串也拒绝。',
    lit: ['ipc', 'requests'],
    shown: ['dispatch'],
    marks: { ipc: 'isTopFrame(senderFrame)' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 286,
      lines: [
        "ipcMain.handle('gwb:request', (event, channel: unknown, payload: unknown) => {",
        "  if (!isTopFrame(event.senderFrame)) throw new Error('gwb:request 只接收顶层框架的调用')",
        '  return requests.dispatch(channel, payload)',
        '})',
      ],
      highlight: [287, 287],
    },
  },
  /* ref file="../apps/desktop/src/requests.ts" lines="25-30" hash="fe3d88f4430d" blob="2041dd1920e9" */
  {
    title: '交给处理器，结果包一层传输状态',
    text:
      '查到处理器就把载荷交给它、等它的返回值；命令插件在处理器里校验命令名、把来源固定为 ui、执行命令，返回自己的回执 { ok, data }。' +
      '内核把返回值原样放进 { available: true, value }：available 只表示「通道有人登记」，和插件的返回值隔开，插件返回的对象里有同名字段也不会被误读。',
    lit: ['requests', 'commands'],
    shown: ['handler'],
    marks: { commands: '执行 shell.panes' },
    code: {
      file: 'apps/desktop/src/requests.ts',
      start: 25,
      lines: [
        '    async dispatch(channel: unknown, payload: unknown): Promise<RequestReply> {',
        '      checkChannel(channel)',
        '      const handler = handlers.get(channel)',
        '      if (handler === undefined) return { available: false }',
        '      return { available: true, value: await handler(payload) }',
        '    },',
      ],
      highlight: [28, 29],
    },
  },
  /* ref file="../apps/desktop/src/preload.cjs" lines="38-42" hash="acee284069bd" blob="97b2299ef0dc" */
  {
    title: '回程：preload 解开传输状态',
    text:
      '回复沿 IPC 回到 preload。available 为 true 时，preload 把 value 原样交给页面，页面拿到的就是命令插件的回执；' +
      '处理器抛错或 IPC 出错时 invoke 拒绝，request 跟着拒绝，内核不把它转成任何业务回执。',
    lit: ['commands', 'requests', 'ipc', 'gwb', 'client'],
    shown: ['return', 'reply', 'replyUp', 'unwrap'],
    marks: { client: '拿到 { ok: true, data }' },
    code: {
      file: 'apps/desktop/src/preload.cjs',
      start: 38,
      lines: [
        '  request: async (channel, payload) => {',
        "    const reply = await ipcRenderer.invoke('gwb:request', channel, payload)",
        '    if (!reply.available) throw new Error(`GWB_REQUEST_UNAVAILABLE: ${channel}`)',
        '    return reply.value',
        '  },',
      ],
      highlight: [40, 41],
    },
  },
  /* ref file="../apps/desktop/tests/requests.test.ts" lines="22-34" hash="5369f0a33118" blob="b660fe70de0c" */
  {
    title: '插件卸载之后',
    text:
      '命令插件卸载，cordis 调用 ctx.effect 里的注销函数，表里那一条删掉；已经开始的请求照样完成。之后再发来的 commands.run 查不到处理器，' +
      '内核回 { available: false }，preload 抛出 GWB_REQUEST_UNAVAILABLE: commands.run。命令插件的页面客户端认得这个错误，把它换成一条命令失败回执；换成什么是命令插件的事。',
    lit: ['requests', 'ipc', 'gwb', 'client'],
    shown: ['invoke', 'dispatch', 'reply', 'replyUp', 'reject'],
    marks: { requests: '没有 commands.run', commands: '已卸载' },
    code: {
      file: 'apps/desktop/tests/requests.test.ts',
      start: 22,
      lines: [
        "  it('注销拒绝新请求，已开始的异步请求仍可完成；处理器异常原样拒绝', async () => {",
        '    const requests = createRequests()',
        '    let finish!: (value: number) => void',
        "    const off = requests.handle('slow', () => new Promise<number>((resolve) => { finish = resolve }))",
        "    const pending = requests.dispatch('slow', undefined)",
        '    off()',
        "    expect(await requests.dispatch('slow', undefined)).toEqual({ available: false })",
        '    finish(42)',
        '    expect(await pending).toEqual({ available: true, value: 42 })',
        "    const error = new Error('broken')",
        "    requests.handle('broken', () => { throw error })",
        "    await expect(requests.dispatch('broken', null)).rejects.toBe(error)",
        '  })',
      ],
      highlight: [27, 30],
    },
  },
];
