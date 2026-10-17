/**
 * 「浏览器模块登记与页面准备的几种情况」的讲解数据：画面（import-cases.tsx）与机读版规则（import-cases.ai.mjs）都只读这一份。
 * 每种情况两边对照：主进程里的登记快照（名字 → 地址，几个登记者），这份页面文档里已经注入的 importmap（每段一张）；
 * 上面是这次发生的调用，下面是结果。报错原文照抄 apps/desktop/src/，正上方的记号把它钉在源码上；包名、版本与地址是示例。
 */

const REACT_V1 = 'file:///…/gwb-shell@1.0.0/dist/react.js';
const REACT_DOM_V1 = 'file:///…/gwb-shell@1.0.0/dist/react-dom-client.js';
const REACT_V2 = 'file:///…/gwb-shell@1.1.0/dist/react.js';
const CHART = 'file:///…/gwb-chart@0.3.0/dist/chart.js';

/**
 * @typedef {'new' | 'gone' | 'changed' | undefined} Mark
 * @typedef {{ name: string, url: string, count: number, mark?: Mark }} RegistryRow
 * @typedef {{ name: string, url: string, mark?: Mark }} MapRow
 * @typedef {{ id: string, label: string, text: string, call: string, registry: RegistryRow[], documentMaps: MapRow[][], result: string, tone: 'good' | 'bad' | 'warn' }} ImportCase
 * @type {ImportCase[]}
 */
export const cases = [
  {
    id: 'first',
    label: '第一次准备',
    text:
      '外壳插件登记了两个名字之后交出页面地址。页面入口挂载前调用 prepareImports()：preload 取回快照，这份文档里还什么都没注入，于是整张快照写成一段 importmap。插入之后 promise 才兑现，接着才动态 import 外壳。',
    call: 'await window.gwb.prepareImports()',
    registry: [
      { name: 'react', url: REACT_V1, count: 1 },
      { name: 'react-dom/client', url: REACT_DOM_V1, count: 1 },
    ],
    documentMaps: [
      [
        { name: 'react', url: REACT_V1, mark: 'new' },
        { name: 'react-dom/client', url: REACT_DOM_V1, mark: 'new' },
      ],
    ],
    result: '兑现：插入一段 importmap',
    tone: 'good',
  },
  {
    id: 'append',
    label: '后来登记的新名字',
    text:
      '另一个插件后来登记了 @demo/chart。外壳加载它的窗格之前调用 prepareImports，preload 只把这份文档里还没有的名字写成新的一段；已经注入的 react 不重写。',
    call: "await window.gwb.prepareImports(['@demo/chart'])",
    registry: [
      { name: 'react', url: REACT_V1, count: 1 },
      { name: 'react-dom/client', url: REACT_DOM_V1, count: 1 },
      { name: '@demo/chart', url: CHART, count: 1, mark: 'new' },
    ],
    documentMaps: [
      [
        { name: 'react', url: REACT_V1 },
        { name: 'react-dom/client', url: REACT_DOM_V1 },
      ],
      [{ name: '@demo/chart', url: CHART, mark: 'new' }],
    ],
    result: '兑现：只追加新名字那一段',
    tone: 'good',
  },
  /* ref file="../apps/desktop/src/preload.cjs" lines="11-11" hash="19b9493e8c28" blob="97b2299ef0dc" */
  {
    id: 'missing',
    label: '必需的名字还没登记',
    text:
      '调用方点名要 @demo/chart，但提供方还没加载完、快照里没有它。prepareImports 当场拒绝，什么都不注入，也不等未知的提供方；之后可以再调用一次。等提供方就绪要靠 cordis 的依赖与服务，不靠这里。',
    call: "await window.gwb.prepareImports(['@demo/chart'])",
    registry: [
      { name: 'react', url: REACT_V1, count: 1 },
      { name: 'react-dom/client', url: REACT_DOM_V1, count: 1 },
    ],
    documentMaps: [
      [
        { name: 'react', url: REACT_V1 },
        { name: 'react-dom/client', url: REACT_DOM_V1 },
      ],
    ],
    result: '拒绝：浏览器模块 @demo/chart 尚未登记；先等待提供方就绪',
    tone: 'bad',
  },
  {
    id: 'shared',
    label: '两个插件登记同名同地址',
    text:
      '两个插件都登记了同一个名字、同一个地址：主进程复用这一条、登记者记成两个。其中一个撤销，名字还在快照里；最后一个登记者撤销后才移除。页面文档不受影响。',
    call: '插件 A 卸载，它登记 react 的撤销函数被调用',
    registry: [
      { name: 'react', url: REACT_V1, count: 1, mark: 'changed' },
      { name: 'react-dom/client', url: REACT_DOM_V1, count: 1 },
    ],
    documentMaps: [
      [
        { name: 'react', url: REACT_V1 },
        { name: 'react-dom/client', url: REACT_DOM_V1 },
      ],
    ],
    result: '快照里 react 还在：登记者从 2 个变成 1 个',
    tone: 'good',
  },
  /* ref file="../apps/desktop/src/browser-imports.ts" lines="17-20" hash="48e079c78ec8" blob="a9ce57cbee25" */
  {
    id: 'conflict',
    label: '同名不同地址',
    text:
      '已经有人把 react 登记到 1.0.0 的文件，另一个插件又要把 react 登记到别的地址：registerImports 直接抛错，错误里列出两个地址。整批先校验再登记，这一批里别的名字也一个都不登记。',
    call: "ctx.gwbKernel.registerImports({ react: 'file:///…/other/react.js', '@demo/chart': '…' })",
    registry: [
      { name: 'react', url: REACT_V1, count: 1 },
      { name: 'react-dom/client', url: REACT_DOM_V1, count: 1 },
    ],
    documentMaps: [
      [
        { name: 'react', url: REACT_V1 },
        { name: 'react-dom/client', url: REACT_DOM_V1 },
      ],
    ],
    result: '抛错：浏览器模块 react 冲突：file:///…/gwb-shell@1.0.0/dist/react.js 与 file:///…/other/react.js',
    tone: 'bad',
  },
  /* ref file="../apps/desktop/src/preload.cjs" lines="13-15" hash="f057345486fe" blob="97b2299ef0dc" */
  {
    id: 'reload',
    label: '提供方升级，地址变了',
    text:
      '外壳插件升到 1.1.0：旧版卸载时撤销了登记，新版登记 react 到新地址。这份文档已经按旧地址注入过 react，同一份文档里的 importmap 改不了，旧的 react 模块实例也还活着。' +
      '所以下一次 prepareImports 拒绝并要求整页重载；页面入口把它显示在状态页上，但不记成启动故障。整页重载后是一份新文档，按新快照注入。',
    call: 'await window.gwb.prepareImports()',
    registry: [
      { name: 'react', url: REACT_V2, count: 1, mark: 'changed' },
      { name: 'react-dom/client', url: 'file:///…/gwb-shell@1.1.0/dist/react-dom-client.js', count: 1, mark: 'changed' },
    ],
    documentMaps: [
      [
        { name: 'react', url: REACT_V1, mark: 'gone' },
        { name: 'react-dom/client', url: REACT_DOM_V1, mark: 'gone' },
      ],
    ],
    result: '拒绝：GWB_IMPORTS_RELOAD_REQUIRED: 浏览器模块 react 已改变或撤销，需要整页重载',
    tone: 'warn',
  },
];
