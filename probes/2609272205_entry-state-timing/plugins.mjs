// 探针用的插件：每个在关键时刻调用 globalThis.__probe.mark 记一笔，run.mjs 按名字交给 loader
import { Service } from 'cordis'

const mark = (text) => globalThis.__probe.mark(text)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const syncPlugin = {
  name: 'probe-sync',
  apply(ctx, config) {
    mark(`probe-sync apply（config=${JSON.stringify(config)}）`)
    ctx.effect(() => () => mark('probe-sync 撤销副作用'))
  },
}

export const asyncPlugin = {
  name: 'probe-async',
  async apply(ctx) {
    mark('probe-async apply 开始，等 300ms')
    await sleep(300)
    ctx.effect(() => () => mark('probe-async 撤销副作用'))
    mark('probe-async apply 结束')
  },
}

export const syncFailPlugin = {
  name: 'probe-sync-fail',
  apply() {
    mark('probe-sync-fail apply，马上抛错')
    throw new Error('probe-sync-fail 同步抛出的错误')
  },
}

export const asyncFailPlugin = {
  name: 'probe-async-fail',
  async apply() {
    mark('probe-async-fail apply 开始，200ms 后 reject')
    await sleep(200)
    throw new Error('probe-async-fail 异步 reject 的错误')
  },
}

export class AsyncService extends Service {
  constructor(ctx) {
    super(ctx, 'probeSvc')
    mark('probe-svc-async 构造（已 provide probeSvc）')
  }

  async [Service.init]() {
    mark('probe-svc-async init 开始，等 400ms')
    await sleep(400)
    mark('probe-svc-async init 结束')
  }
}

export const needsServicePlugin = {
  name: 'probe-needs-svc',
  inject: ['probeSvc'],
  apply(ctx) {
    mark(`probe-needs-svc apply，拿到 probeSvc=${ctx.probeSvc instanceof AsyncService}`)
    ctx.effect(() => () => mark('probe-needs-svc 撤销副作用'))
  },
}

export const needsNobodyPlugin = {
  name: 'probe-needs-nobody',
  inject: ['nobodyProvidesThis'],
  apply() {
    mark('probe-needs-nobody apply（不该出现）')
  },
}

const nestedChild = {
  name: 'probe-nested-child',
  async apply() {
    mark('probe-nested-child apply 开始，等 100ms')
    await sleep(100)
    mark('probe-nested-child apply 结束')
  },
}

export const nestedPlugin = {
  name: 'probe-nested',
  apply(ctx) {
    mark('probe-nested apply，里面 ctx.plugin(probe-nested-child)')
    ctx.plugin(nestedChild)
  },
}
