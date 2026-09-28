/**
 * 「启动失败与插件出错时留下什么」的讲解数据：画面（boot-failure.tsx）与机读版规则（boot-failure.ai.mjs）都只读这一份。
 * 每种情况给出五处各自的结果：stderr、gwb.log、错误框、runtime.json、进程。
 * tone 是那一格的颜色：info 写了或弹了，bad 退出，good 照常运行，null 没有动静。
 */

/** 五处，按一次启动里先后碰到的顺序 */
export const outlets = [
  { id: 'stderr', name: 'stderr' },
  { id: 'log', name: 'gwb.log' },
  { id: 'dialog', name: '错误框' },
  { id: 'runtime', name: 'runtime.json' },
  { id: 'exit', name: '进程' },
];

/**
 * @typedef {{ tone: 'info' | 'bad' | 'good' | null, text: string }} Outcome
 * @typedef {{ id: string, label: string, text: string, when: string, outcomes: Record<string, Outcome> }} FailureCase
 * @type {FailureCase[]}
 */
export const cases = [
  {
    id: 'lock',
    label: '同一个 home 已有实例',
    when: '模块求值时',
    text:
      '新实例拿不到单实例锁：写一行 error、退出码 1，不弹框。runtime.json 不动，在运行的那个实例的记录不被覆盖；' +
      '已在运行的实例收到 second-instance，把窗口调到前面。人第二次双击看到的是原来的窗口到了前面。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: 'info', text: '同一行' },
      dialog: { tone: null, text: '不弹' },
      runtime: { tone: null, text: '不动' },
      exit: { tone: 'bad', text: '退出码 1' },
    },
  },
  {
    id: 'logfile',
    label: 'gwb.log 打不开',
    when: '模块求值时',
    text:
      '日志文件本身用不了，不能走 reportBootFailureAndExit（它先写的正是这个文件）：只写 stderr，错误框里写明文件路径与打不开的原因，退出码 1。' +
      '所以 gwb.log 在其余检查之前打开，那几项失败时的那一行才进得了日志文件。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: null, text: '打不开' },
      dialog: { tone: 'info', text: '路径与原因' },
      runtime: { tone: null, text: '不写' },
      exit: { tone: 'bad', text: '退出码 1' },
    },
  },
  {
    id: 'homefiles',
    label: '缺 package.json 或 cordis.yml',
    when: '模块求值时',
    text:
      '走 reportBootFailureAndExit：先写一行 error，再弹错误框（框里带 gwb.log 的路径），退出码 1。报错写明缺哪个、home 在哪、由谁准备，内核不补；' +
      '补一份空的会让工作台带着空条目表照常启动，掩盖 home 没装好这件事。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: 'info', text: '同一行' },
      dialog: { tone: 'info', text: '缺哪个 · 日志路径' },
      runtime: { tone: null, text: '还没写' },
      exit: { tone: 'bad', text: '退出码 1' },
    },
  },
  {
    id: 'gwb-debug',
    label: 'GWB_DEBUG 写错',
    when: '模块求值时',
    text:
      '环境变量 GWB_DEBUG 逗号之间是空的（比如末尾多一个逗号），或写了 cordis 级别表的保留项 default：启动失败，报错带着给的原值，runtime.json 不写。' +
      '名字写错了但格式对的不报错：启动时插件还没加载，内核认不出哪些 logger 名存在，那个名字只是没有日志。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: 'info', text: '同一行' },
      dialog: { tone: 'info', text: '给的原值' },
      runtime: { tone: null, text: '不写' },
      exit: { tone: 'bad', text: '退出码 1' },
    },
  },
  {
    id: 'port',
    label: '调试端口给错',
    when: '模块求值时',
    text:
      '--remote-debugging-port 给了、但不是 1–65535 的十进制整数（abc、0、65536、1.5）：启动失败，报错带着给的原值，runtime.json 不写。' +
      '没给这个开关时照常启动，只是 runtime.json 里没有 cdp。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: 'info', text: '同一行' },
      dialog: { tone: 'info', text: '给的原值' },
      runtime: { tone: null, text: '不写' },
      exit: { tone: 'bad', text: '退出码 1' },
    },
  },
  {
    id: 'runtime',
    label: 'runtime.json 写不进',
    when: '模块求值时',
    text:
      'devkit 与安装工作台的 agent 靠这份文件找到运行中的工作台。写不进时照常启动的话，外部工具找不到它，错误出现在离原因很远的地方；所以启动失败，报错写明文件路径与原因。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: 'info', text: '同一行' },
      dialog: { tone: 'info', text: '路径与原因' },
      runtime: { tone: null, text: '写不进' },
      exit: { tone: 'bad', text: '退出码 1' },
    },
  },
  {
    id: 'ready',
    label: 'ready 之后抛错',
    when: 'ready 之后',
    text:
      '开窗口、加载 index.html、注册 loader 这几步抛出的错误沿 whenReady 的 promise 链交给 reportBootFailureAndExit。runtime.json 已经写过，退出时不删，读它的一方自己确认 pid 还活着。' +
      '插件自己加载失败不在这里：cordis 把错误记在它的条目上，内核照常启动，只读状态页与挂载日志里看得到。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: 'info', text: '同一行' },
      dialog: { tone: 'info', text: '错误 · 日志路径' },
      runtime: { tone: null, text: '已写，留着' },
      exit: { tone: 'bad', text: '退出码 1' },
    },
  },
  {
    id: 'plugin',
    label: '插件抛出未捕获的异常',
    when: '运行中',
    text:
      '插件和内核在同一个进程里，插件的错误就是这个进程的错误。内核对未捕获的异常和没人处理的 rejection 只写一行名字为 kernel 的 error，不弹框、不退出：一个坏插件不该让整个工作台退出。',
    outcomes: {
      stderr: { tone: 'info', text: '一行 error' },
      log: { tone: 'info', text: '同一行' },
      dialog: { tone: null, text: '不弹' },
      runtime: { tone: null, text: '不变' },
      exit: { tone: 'good', text: '照常运行' },
    },
  },
];
