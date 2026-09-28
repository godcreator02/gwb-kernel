/**
 * 「页面从只读状态页到交给外壳」的讲解数据：画面（shell-handover.tsx）与机读版规则（shell-handover.ai.mjs）都只读这一份。
 * 例子是一个外壳插件：它先登记浏览器模块，再调用 setShell 交出自己的页面模块地址，后来又被卸载。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、#root 此刻显示什么、对应哪段源码。源码片段照抄 apps/desktop/src/，正上方的记号把它钉在源码上。
 */

/**
 * 参与者：外壳插件绿色，内核主进程蓝色，preload 紫色，页面入口青色，#root 琥珀色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/docfirst-explainer').Role }[]}
 */
export const actors = [
  { id: 'plugin', name: '外壳插件', sub: '主进程里的 apply', role: 'emerald' },
  { id: 'kernel', name: '内核服务', sub: 'gwbKernel', role: 'blue' },
  { id: 'registry', name: '浏览器模块登记', sub: 'browser-imports.ts', role: 'blue' },
  { id: 'preload', name: 'preload', sub: 'onShell · prepareImports', role: 'violet' },
  { id: 'page', name: '页面入口', sub: 'index.html 的脚本', role: 'cyan' },
  { id: 'root', name: '#root', sub: '空', role: 'amber' },
];

/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} HandoverStep
 * @type {HandoverStep[]}
 */
export const steps = [
  /* ref file="../apps/desktop/src/preload.cjs" lines="45-50" hash="c4f6a2d14475" blob="97b2299ef0dc" */
  {
    title: '窗口打开，先问外壳是谁',
    text:
      '内核先让窗口加载 index.html，再加载插件，所以页面脚本运行时通常还没有插件调用过 setShell。页面入口一订阅 onShell，preload 就发一次 gwb:hello；' +
      '主进程回一条整份外壳状态 { url, report }。此刻 url 是 null，页面在 #root 上画只读状态页：第一句「没有外壳插件」，然后是 home、每个条目一行、最近的错误行。',
    lit: ['page', 'preload', 'kernel', 'root'],
    shown: ['hello', 'shellMsg', 'draw'],
    marks: { root: '只读状态页', kernel: 'url: null' },
    code: {
      file: 'apps/desktop/src/preload.cjs',
      start: 45,
      lines: [
        '  onShell: (callback) => {',
        "    const unsubscribe = subscribe('gwb:shell', callback)",
        '    // 订阅后马上问一次当前值：外壳插件可能在页面就位之前就调过 setShell',
        "    ipcRenderer.send('gwb:hello')",
        '    return unsubscribe',
        '  },',
      ],
      highlight: [48, 48],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="256-264" hash="06deb6d70bd0" blob="b613d37fa683" */
  {
    title: '插件加载中，状态页跟着刷新',
    text:
      '条目状态每变一次、每来一行 error 日志、loader 加载完，主进程都重新推一次整份状态；200 毫秒内的多次合并成一次。warn 只进日志，不触发推送。' +
      'url 还是 null，页面按新的 report 重画状态页：哪些条目 ACTIVE、哪些 PENDING 缺什么服务、哪些 FAILED 带错误第一行。',
    lit: ['kernel', 'page', 'root'],
    shown: ['shellMsg', 'draw'],
    marks: { root: '只读状态页（重画）', kernel: '去抖 200 ms' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 256,
      lines: [
        'let pendingShellPush: NodeJS.Timeout | null = null',
        'function scheduleShellPush(): void {',
        '  if (pendingShellPush !== null) return',
        '  pendingShellPush = setTimeout(() => {',
        '    pendingShellPush = null',
        '    pushShellMessageNow()',
        '  }, SHELL_PUSH_DEBOUNCE_MS)',
        '}',
        "ctx.on('internal/status', () => scheduleShellPush())",
      ],
    },
  },
  /* ref file="../apps/desktop/src/main.ts" lines="273-283" hash="22635bb98b06" blob="b613d37fa683" */
  {
    title: '外壳插件登记模块、交出地址',
    text:
      '外壳插件在 apply 里先 registerImports 登记自己提供给页面的浏览器模块（比如 react），再 setShell(自己页面模块的 file: 地址)，两个返回的撤销函数都交给 ctx.effect。' +
      'setShell 不去抖，立刻推一次整份状态；后调用的替换先调用的。',
    lit: ['plugin', 'kernel', 'registry'],
    shown: ['register', 'setShell', 'shellMsg'],
    marks: { kernel: 'url: file:///…/client.js', registry: 'react → file:///…' },
    code: {
      file: 'apps/desktop/src/main.ts',
      start: 273,
      lines: [
        '  registerImports: (imports) => browserImports.register(imports),',
        '  setShell: (url) => {',
        '    currentShellUrl = url',
        '    pushShellMessageNow()',
        '    return () => {',
        '      if (currentShellUrl !== url) return',
        '      currentShellUrl = null',
        '      pushShellMessageNow()',
        '    }',
        '  },',
        '}',
      ],
      highlight: [274, 276],
    },
  },
  /* ref file="../apps/desktop/src/index.html" lines="97-106" hash="4f3ac61389dc" blob="27f4d97bcf1c" */
  {
    title: '页面收到新地址：先清掉旧的',
    text:
      '页面入口收到一个和当前不同的地址：记下「这个地址正在加载」，调用旧外壳的 dispose（有的话，抛错只打一行 console.error），清空 #root。' +
      '地址是 null 就画状态页到此为止；否则进入挂载。每次换地址都加一代计数，旧一代的异步结果回来时认得出自己已经过期。',
    lit: ['page', 'root'],
    shown: ['shellMsg'],
    marks: { root: '清空' },
    code: {
      file: 'apps/desktop/src/index.html',
      start: 97,
      lines: [
        '        failedShell = null',
        '        shellUrlBeingLoaded = url',
        '        const generation = ++shellGeneration',
        '        try {',
        '          disposeCurrentShell()',
        '          if (url === null) {',
        "            showStatusPage('没有外壳插件（没有插件调用 setShell）。', shell.report)",
        '            return',
        '          }',
        '          await mountShell(url, shell.report, generation)',
      ],
      highlight: [101, 106],
    },
  },
  /* ref file="../apps/desktop/src/preload.cjs" lines="8-23" hash="49a3a042ea09" blob="97b2299ef0dc" */
  {
    title: '先准备 importmap',
    text:
      '挂载前页面入口先 await window.gwb.prepareImports()：preload 经 gwb:imports 向主进程要当前登记的快照，只把这份文档里还没注入的名字写成一段新的 <script type="importmap">。' +
      '已经注入过的名字地址变了或被撤销，就拒绝并要求整页重载——同一份文档里的映射改不了。',
    lit: ['page', 'preload', 'registry'],
    shown: ['imports'],
    marks: { preload: '追加 importmap' },
    code: {
      file: 'apps/desktop/src/preload.cjs',
      start: 8,
      lines: [
        'async function applyImports(required) {',
        "  const imports = await ipcRenderer.invoke('gwb:imports')",
        '  for (const name of required) {',
        '    if (!Object.hasOwn(imports, name)) throw new Error(`浏览器模块 ${name} 尚未登记；先等待提供方就绪`)',
        '  }',
        '  for (const [name, url] of appliedImports) {',
        '    if (imports[name] !== url) throw new Error(`GWB_IMPORTS_RELOAD_REQUIRED: 浏览器模块 ${name} 已改变或撤销，需要整页重载`)',
        '  }',
        '  const added = Object.fromEntries(Object.entries(imports).filter(([name]) => !appliedImports.has(name)))',
        '  if (Object.keys(added).length === 0) return',
        "  const script = document.createElement('script')",
        "  script.type = 'importmap'",
        '  script.textContent = JSON.stringify({ imports: added })',
        '  document.head.appendChild(script)',
        '  for (const [name, url] of Object.entries(added)) appliedImports.set(name, url)',
        '}',
      ],
      highlight: [16, 21],
    },
  },
  /* ref file="../apps/desktop/src/index.html" lines="71-78" hash="21a222533841" blob="27f4d97bcf1c" */
  {
    title: 'import 外壳，把 #root 交出去',
    text:
      '映射就绪后才动态 import 外壳地址——静态 import 等不了这一步。模块的默认导出必须是函数（类型 ShellBoot），页面入口把 #root 交给它，留下它返回的可选 dispose。' +
      '从这一刻起 #root 里的一切归外壳，内核页面不再画任何东西。',
    lit: ['page', 'root'],
    shown: ['mount'],
    marks: { root: '外壳的界面', page: 'default(root)' },
    code: {
      file: 'apps/desktop/src/index.html',
      start: 71,
      lines: [
        '      async function mountShell(url, report, generation) {',
        '        try {',
        '          await window.gwb.prepareImports()',
        '          if (generation !== shellGeneration) return',
        '          const shellModule = await import(url)',
        '          if (generation !== shellGeneration) return',
        "          if (typeof shellModule.default !== 'function') throw new Error(`${url} 的默认导出不是函数`)",
        '          currentShell = { url, handle: shellModule.default(root) ?? null }',
      ],
      highlight: [75, 78],
    },
  },
  /* ref file="../apps/desktop/src/index.html" lines="88-96" hash="676ef8077a77" blob="27f4d97bcf1c" */
  {
    title: '同一个地址又推来：什么都不做',
    text:
      '外壳在用时主进程照样会推状态（有新的 error 日志、条目状态变化），url 没变。页面入口遇到正在用或正在加载的同一个地址直接忽略，外壳不会挂载两遍；' +
      '订阅时问到的那一条与去抖推送的那一条都在 import 完成之前到达时，靠「正在加载」这个记号认出来。',
    lit: ['kernel', 'page'],
    shown: ['shellMsg'],
    marks: { root: '外壳的界面', page: '同一地址，忽略' },
    code: {
      file: 'apps/desktop/src/index.html',
      start: 88,
      lines: [
        '      window.gwb.onShell(async (shell) => {',
        '        const url = shell.url',
        '        // 订阅时请求的一条与去抖推送的一条可能都在 import 完成之前到达，只比 currentShell 的话外壳会挂载两遍',
        '        if (currentShell?.url === url || shellUrlBeingLoaded === url) return',
        '        // error 会触发新的状态报告；同一失败不能再次产生日志，否则形成反馈循环。',
        '        if (failedShell?.url === url) {',
        '          showStatusPage(failedShell.message, shell.report)',
        '          return',
        '        }',
      ],
      highlight: [91, 91],
    },
  },
  /* ref file="../apps/desktop/src/index.html" lines="61-69" hash="b10b5eb86928" blob="27f4d97bcf1c" */
  {
    title: '外壳插件卸载：交还页面',
    text:
      '外壳插件卸载时 cordis 调用 ctx.effect 里的撤销函数；它只在自己仍是当前外壳时把地址清成 null 并推送（已经被后来者替换的，撤销什么都不做）。' +
      '页面入口收到 url: null，调用外壳的 dispose、清空 #root，画回只读状态页。dispose 必须同步清理完：清空 #root 紧跟在它后面。',
    lit: ['plugin', 'kernel', 'page', 'root'],
    shown: ['revoke', 'shellMsg', 'draw'],
    marks: { kernel: 'url: null', root: '只读状态页' },
    code: {
      file: 'apps/desktop/src/index.html',
      start: 61,
      lines: [
        '      function disposeCurrentShell() {',
        '        try {',
        '          currentShell?.handle?.dispose?.()',
        '        } catch (err) {',
        '          console.error(`旧外壳 dispose 失败：${String(err)}`)',
        '        }',
        '        currentShell = null',
        "        root.textContent = ''",
        '      }',
      ],
      highlight: [63, 68],
    },
  },
  /* ref file="../apps/desktop/src/index.html" lines="79-85" hash="e13a95ad7561" blob="27f4d97bcf1c" */
  {
    title: '外壳起不来：回到状态页，不白屏',
    text:
      'import 抛错、默认导出不是函数、prepareImports 拒绝，页面入口都画只读状态页，第一句写「外壳启动失败：原因」，并打一行 console.error（它经页面日志进 gwb.log）。' +
      '要求整页重载的那种不打 console.error：那是提供方更新时的正常过渡。同一个失败地址再推来只更新状态页，不再重试、不再打日志，否则 error 日志触发推送、推送又触发重试，会一直循环。',
    lit: ['page', 'root'],
    shown: ['draw'],
    marks: { root: '外壳启动失败：…', page: 'failedShell' },
    code: {
      file: 'apps/desktop/src/index.html',
      start: 79,
      lines: [
        '        } catch (err) {',
        '          if (generation !== shellGeneration) return',
        '          failedShell = { url, message: `外壳启动失败：${String(err)}` }',
        '          // 更新提供方到整页刷新之间的正常过渡，不把已知的刷新要求记成启动故障。',
        "          if (!String(err).includes('GWB_IMPORTS_RELOAD_REQUIRED:')) console.error(failedShell.message)",
        '          showStatusPage(failedShell.message, report)',
        '        }',
      ],
      highlight: [81, 84],
    },
  },
];
