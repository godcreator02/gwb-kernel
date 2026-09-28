/**
 * 「一次启动与一条命令」的讲解数据：画面（boot-and-request.tsx）与机读版规则（boot-and-request.ai.mjs）都只读这一份。
 * 每一步是一组消息：从哪条竖线到哪条竖线、箭头上写什么、走的是首页接缝图上的第几条接缝（null 是内核包内部的 IPC）。
 * 箭头上的名字照抄源码，正上方的记号把它钉在源码上。
 */

/**
 * 竖线：安装包是琥珀色、内核是蓝色，与首页接缝图一致；包外的东西是灰色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/docfirst-explainer').Role }[]}
 */
export const lanes = [
  { id: 'launcher', name: '启动器', sub: 'apps/launcher', role: 'amber' },
  { id: 'main', name: '内核主进程', sub: 'main.ts', role: 'blue' },
  { id: 'cordis', name: 'cordis', sub: 'loader · include', role: 'slate' },
  { id: 'plugins', name: '插件', sub: 'cordis.yml 里的', role: 'slate' },
  { id: 'page', name: '页面', sub: 'index.html · window.gwb', role: 'slate' },
  { id: 'home', name: 'home 里的文件', sub: 'GWB_HOME', role: 'slate' },
];

/**
 * @typedef {{ from: string, to: string, label: string, seam: number | null }} Message
 * @typedef {{ title: string, text: string, messages: Message[] }} BootStep
 * @type {BootStep[]}
 */
export const steps = [
  /* ref file="../apps/launcher/src/main.ts" lines="17-29" hash="0f906fc09c31" blob="f6547781d717" */
  {
    title: '从开始菜单到内核入口',
    text:
      '人从开始菜单打开 gwb-kernel，Electron 运行的是安装包里的启动器。启动器按 GWB_HOME 选定 home（只写名字时在 appData 下的 gwb-kernel/homes/<名字>，不设就是 default），' +
      '把绝对路径写回 GWB_HOME；再读 home 里内核包的清单：当前 Electron 在 engines.electron 的范围里、清单有 main，才 import 这个入口。任何一项不满足就弹框，退出码 1。',
    messages: [
      { from: 'launcher', to: 'home', label: 'package.json：engines.electron、main', seam: 1 },
      { from: 'launcher', to: 'main', label: 'import(main)', seam: 1 },
    ],
  },
  /* ref file="../apps/desktop/src/main.ts" lines="50-63" hash="2cf16ed46b50" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/main.ts" lines="105-119" hash="eddcba4adb21" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/main.ts" lines="147-151" hash="3c19c4c90a26" blob="b613d37fa683" */
  {
    title: '内核准备 home',
    text:
      '内核的入口模块一求值就做这几件事，不等 Electron 的 ready：按同一条规则再选一次 home 并取磁盘上的真实路径，Chromium 的数据目录设在 <home>/electron；' +
      '拿单实例锁、打开 gwb.log（打不开就只写 stderr、弹框退出），同一个 home 已有实例就写一行日志退出；package.json 与 cordis.yml 缺一个就启动失败，内核不补；' +
      '最后把进程号、启动时刻、版本、调试端口整份写进 runtime.json。',
    messages: [
      { from: 'main', to: 'home', label: '打开 gwb.log', seam: 11 },
      { from: 'main', to: 'home', label: '查 package.json、cordis.yml', seam: 3 },
      { from: 'main', to: 'home', label: '写 runtime.json', seam: 12 },
    ],
  },
  /* ref file="../apps/desktop/src/main.ts" lines="153-155" hash="c80508e65041" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/main.ts" lines="284-294" hash="3b1194ad1282" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/main.ts" lines="358-362" hash="177f922bd078" blob="b613d37fa683" */
  {
    title: '建 cordis 实例，打开窗口',
    text:
      '内核建 cordis 实例、把 home 设成模块解析起点、注册唯一的日志 exporter，在根上下文上提供 gwbKernel——这时还没有任何插件。' +
      'Electron ready 之后去掉默认菜单、打开窗口、加载内核包里的 index.html。页面入口订阅外壳状态，preload 随即发 gwb:hello，主进程回一条整份的外壳状态；' +
      '此刻没有插件调用过 setShell，url 是 null，页面显示只读状态页。虚线是内核包内部的 IPC，两端都在内核包里。',
    messages: [
      { from: 'main', to: 'cordis', label: "new Context()；provide('gwbKernel')", seam: 2 },
      { from: 'main', to: 'page', label: 'loadFile(index.html)', seam: null },
      { from: 'page', to: 'main', label: 'gwb:hello', seam: null },
      { from: 'main', to: 'page', label: 'gwb:shell { url: null, report }', seam: null },
    ],
  },
  /* ref file="../apps/desktop/src/main.ts" lines="349-356" hash="e5fc330ba54d" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/bare-import.ts" lines="10-18" hash="a38ff6e7d777" blob="a03471e3e333" */
  {
    title: '加载 cordis.yml 里的插件',
    text:
      '内核注册 loader，把它的包名 import 换成按 home 解析，把 include 交给它，再在根层放一条 id 为 home 的 include 条目。include 读 home 的 cordis.yml，逐条 import 插件包：' +
      '包名先解析成 <home>/node_modules 下的真实路径，再从那里找入口。插件 inject 的服务都在了，cordis 调用它的 apply；内核按条目写一行日志，说它加载成功还是失败。',
    messages: [
      { from: 'main', to: 'cordis', label: "ctx.plugin(Loader)；根条目 home", seam: 2 },
      { from: 'cordis', to: 'home', label: '读 cordis.yml', seam: 3 },
      { from: 'cordis', to: 'home', label: 'import node_modules 真实路径下的包', seam: 3 },
      { from: 'cordis', to: 'plugins', label: 'apply(ctx)', seam: 4 },
    ],
  },
  /* ref file="../apps/desktop/src/main.ts" lines="273-282" hash="90d67a6739aa" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/index.html" lines="71-78" hash="21a222533841" blob="27f4d97bcf1c" */
  {
    title: '外壳插件接管页面',
    text:
      '外壳插件先用 registerImports 登记 React 的几个包名，再用 setShell 交出自己页面模块的地址；主进程立刻把新的外壳状态推给页面。' +
      '页面入口先 prepareImports——preload 经 gwb:imports 取主进程的登记快照、写成页面上的 importmap——再 import 这个地址，把 #root 交给它的默认导出。',
    messages: [
      { from: 'plugins', to: 'main', label: 'registerImports({ react: … })', seam: 7 },
      { from: 'plugins', to: 'main', label: 'setShell(url)', seam: 8 },
      { from: 'main', to: 'page', label: 'gwb:shell { url }', seam: null },
      { from: 'page', to: 'main', label: 'gwb:imports', seam: null },
      { from: 'page', to: 'plugins', label: 'import(url) → ShellBoot(#root)', seam: 8 },
    ],
  },
  /* ref file="../apps/desktop/src/preload.cjs" lines="38-42" hash="acee284069bd" blob="97b2299ef0dc" */
  /* ref file="../apps/desktop/src/main.ts" lines="286-289" hash="95573aa880ff" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/requests.ts" lines="25-30" hash="fe3d88f4430d" blob="2041dd1920e9" */
  {
    title: '页面调一条命令',
    text:
      '外壳的页面代码调命令插件的浏览器客户端，客户端经 window.gwb.request 发到命令插件登记的通道。主进程只收顶层框架的请求，按通道名找到处理器，把载荷原样交过去；' +
      '处理器的返回值包成 { available: true, value } 交回，preload 解开，页面拿到回执。通道没登记时主进程回 { available: false }，preload 以 GWB_REQUEST_UNAVAILABLE 拒绝。',
    messages: [
      { from: 'page', to: 'main', label: 'request(channel, payload)', seam: 9 },
      { from: 'main', to: 'plugins', label: 'handler(payload)', seam: 6 },
      { from: 'plugins', to: 'main', label: '回执', seam: 6 },
      { from: 'main', to: 'page', label: '{ available: true, value }', seam: 9 },
    ],
  },
  /* ref file="../apps/desktop/src/main.ts" lines="176-184" hash="02b49b6c7079" blob="b613d37fa683" */
  /* ref file="../apps/desktop/src/main.ts" lines="340-342" hash="cb8cdc7db26f" blob="b613d37fa683" */
  {
    title: '一路上的日志',
    text:
      '插件经 ctx.logger 写的日志、内核自己的日志、页面 console 的输出都进 cordis 的同一条日志流；内核注册的 exporter 把每一条写成 gwb.log 里的一行 JSON，同时往 stderr 写一行文本。' +
      'error 还会在 200 毫秒内触发一次外壳状态推送，没有外壳时它显示在只读状态页上。',
    messages: [
      { from: 'plugins', to: 'main', label: 'ctx.logger(名字).info(…)', seam: 10 },
      { from: 'page', to: 'main', label: 'console → 名字 renderer', seam: 10 },
      { from: 'main', to: 'home', label: 'gwb.log 追加一行 JSON', seam: 11 },
    ],
  },
];
