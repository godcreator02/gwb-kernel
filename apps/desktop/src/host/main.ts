import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import type { GwbKernelApi } from '@godcreator02/gwb-plugin-api'
import { parseCommandLine, type HostMessage } from '../shared/protocol'
import { pluginDir, pluginMeta } from '../shared/entries'
import { ensureHomeManifest, homeInstalled, installPackages, RECOMMENDED } from './install'

/**
 * 宿主子进程入口（纯 node，由主进程以 ELECTRON_RUN_AS_NODE 拉起）。
 * 挂 loader 与 include，provide gwbKernel，守住 fd3 那条命令通道。
 * 取舍与踩过的坑见文档站。
 */

console.log = console.error

const dataDir = process.env.GWB_DATA_DIR ?? path.resolve(process.cwd(), 'gwb-home')
const appVersion = process.env.GWB_VERSION ?? null
const siteDir = path.join(dataDir, 'node_modules')
/** cordis.yml 的位置，相对 baseUrl 的 URL——不是文件系统路径 */
const CONFIG_NAME = 'cordis.yml'
/** 承载 cordis.yml 那条条目的 id；件的 id 挂在它下面（`home:<件>`） */
const ENTRY_ROOT = 'home'

fs.mkdirSync(dataDir, { recursive: true })

// 显式给 fd 时 path 被忽略
const out = fs.createWriteStream('', { fd: 3, encoding: 'utf8' })
out.on('error', (e) => console.error(`[fd3] ${e.message}`))

function send(message: HostMessage): void {
  out.write(JSON.stringify(message) + '\n')
}

const ctx = new Context()

/** 模块解析的起点，指向 home 目录。设在根上下文，loader 与 include 都从这儿继承 */
ctx.baseUrl = pathToFileURL(dataDir + path.sep).href

declare module 'cordis' {
  interface Context {
    /** 内核的服务，根上下文 provide、永不撤销 */
    gwbKernel: GwbKernelApi
    /** 命令总线，由某个件提供；没装那个件就是 undefined */
    gwbCli?: { run(command: string, args?: unknown): Promise<unknown> }
  }
}

/** 一条条目在界面上的样子。`ok` 看 fiber——挂上了才有 */
interface EntryView {
  id: string
  ok: boolean
  pkg: string
  shell: boolean
  disabled: boolean
}

/** 走遍 loader 的条目树；include 是挂在它下面的子树，件的条目在子树里 */
function walkEntries(): EntryView[] {
  const out: EntryView[] = []
  const seen = new Set<unknown>()
  const walk = (tree: { store?: Record<string, unknown> } | undefined): void => {
    if (tree === undefined || seen.has(tree)) return
    seen.add(tree)
    for (const raw of Object.values(tree.store ?? {})) {
      const entry = raw as {
        id?: string
        fiber?: unknown
        disabled?: boolean
        options?: { name?: string }
        subtree?: { store?: Record<string, unknown> }
      }
      const pkg = entry.options?.name ?? ''
      out.push({
        id: entry.id ?? '',
        ok: entry.fiber !== undefined,
        pkg,
        shell: pkg === '' ? false : pluginMeta(pluginDir(pkg, siteDir))?.shell === true,
        disabled: entry.disabled === true,
      })
      walk(entry.subtree)
    }
  }
  walk(ctx.loader as unknown as { store?: Record<string, unknown> })
  return out
}

/** 内核自省口 */
function kernelInfo(): unknown {
  const entries = walkEntries()
  return {
    ok: true,
    data: { pid: process.pid, node: process.versions.node, dataDir, appVersion, entries },
  }
}

const installEnv = {
  homeDir: dataDir,
  pnpm: process.env.GWB_PNPM ?? '',
  log: (line: string) => console.error(`[install] ${line}`),
}

/** 把包装进 home。装完不碰条目树——要生效由调用方去改树 */
async function install(specs: string[]): Promise<{ ok: boolean; data?: { installed: string[] }; error?: string }> {
  if (installEnv.pnpm === '') return { ok: false, error: '没有可用的 pnpm（GWB_PNPM 没传下来）' }
  const result = await installPackages(installEnv, specs)
  return result.ok ? { ok: true, data: { installed: specs } } : result
}

/** 装机的命令口，参数形状在这儿收窄 */
async function kernelInstall(args: unknown): Promise<unknown> {
  const specs = (args as { specs?: unknown })?.specs
  if (!Array.isArray(specs) || specs.some((s) => typeof s !== 'string')) {
    return { ok: false, error: 'kernel.install 要 { specs: string[] }' }
  }
  return install(specs as string[])
}

/** 内核给件的那个服务 */
const kernelApi: GwbKernelApi = {
  dataDir,
  appVersion,
  install,
  emit: (payload) => send({ t: 'event', payload }),
}

/** 除两条自省命令外一律走 ctx.gwbCli——本体不认识任何件的命令名 */
async function dispatch(payload: { command: string; args?: unknown }): Promise<unknown> {
  if (payload.command === 'kernel.info') return kernelInfo()
  if (payload.command === 'kernel.install') return kernelInstall(payload.args)
  const cli = ctx.gwbCli
  if (!cli) return { ok: false, error: `没有命令服务（ctx.gwbCli），认不出 ${payload.command}` }
  return cli.run(payload.command, payload.args)
}

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  if (!line.trim()) return
  const msg = parseCommandLine(line)
  if (msg === undefined) {
    console.error(`[stdin] 不合协议的行，已丢弃：${line.slice(0, 200)}`)
    return
  }
  void dispatch(msg.payload).then(
    (result) => send({ t: 'reply', id: msg.id, result }),
    (err: unknown) => send({ t: 'reply', id: msg.id, result: { ok: false, error: String(err) } }),
  )
})

/** 首启：home 还不是个包就建出来，按推荐列表装一遍。装过了一概不碰 */
async function firstRun(): Promise<void> {
  if (homeInstalled(dataDir)) return
  console.error(`[install] 新 home:${dataDir}`)
  ensureHomeManifest(dataDir)
  await installPackages(installEnv, [...RECOMMENDED])
}

/** 保底日志出口，只管 error。info / warn 归 logger-console 那个件 */
function bootstrapErrorExporter(): void {
  ctx.logger.exporter({
    export: (message) => {
      if (message.type !== 'error') return
      console.error(`[loader] ${message.name}:`, ...message.args)
    },
  })
}

/** 内核只挂 loader，再往它的树上放一条 include，其余全归这两个 */
async function bootLoader(): Promise<void> {
  ctx.provide('gwbKernel', kernelApi)
  bootstrapErrorExporter()
  await ctx.plugin(Loader, {})
  ctx.loader.builtins.include = Include
  await ctx.loader.root.update([{ id: ENTRY_ROOT, name: 'cordis:include', config: { path: CONFIG_NAME } }])
  await ctx.loader.await()
}

void firstRun()
  .then(bootLoader)
  .then(() => {
    const entries = walkEntries()
    console.error(`[host] up，dataDir=${dataDir}，条目 ${entries.filter((e) => e.ok).length}/${entries.length}`)
    for (const e of entries) console.error(`[host]   ${e.ok ? '挂上' : '没挂'} ${e.id}（${e.pkg}）`)
    send({ t: 'ready' })
  })
  .catch((err: unknown) => {
    console.error(`[host] 起不来：${String(err)}`)
    process.exit(1)
  })
