import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 装机：把包名转发给 pnpm，装进 home 的 node_modules。registry 归 pnpm 按 .npmrc 决定。
 * 装不上就回一句原因，不还原、不对账、不重试。取舍见文档站。
 */

/** 首启装什么。空表就只把 home 建出来 */
export const RECOMMENDED: readonly string[] = []

/** 条目表的文件名。这是它的唯一定义，宿主入口从这儿取——两处各写一份必然漂移 */
export const CONFIG_NAME = 'cordis.yml'

/**
 * 把 home 建成**起得来**的最小形态：一份包清单 + 一份空条目表。两样各自判在不在，幂等。
 *
 * `cordis.yml` 不能少：include 件读不到它会抛，而那个错落在 loader 的挂载链上、
 * 是一条未捕获的 promise rejection——**宿主整个退出**，不是「一个件都没装」。
 * 空表 `[]` 才是「一个件都没装」的正当表达。
 */
export function ensureHome(homeDir: string): void {
  fs.mkdirSync(homeDir, { recursive: true })
  const manifest = path.join(homeDir, 'package.json')
  if (!fs.existsSync(manifest)) {
    fs.writeFileSync(manifest, `${JSON.stringify({ name: 'gwb-home', private: true }, null, 2)}\n`, 'utf8')
  }
  const config = path.join(homeDir, CONFIG_NAME)
  if (!fs.existsSync(config)) fs.writeFileSync(config, '[]\n', 'utf8')
}

export function homeInstalled(homeDir: string): boolean {
  return fs.existsSync(path.join(homeDir, 'package.json'))
}

export interface InstallEnv {
  homeDir: string
  /** 自带的 pnpm 入口脚本，由主进程传下来 */
  pnpm: string
  log: (line: string) => void
}

/** 跑一趟 pnpm add。子进程是 electron 当 node 使，所以要 ELECTRON_RUN_AS_NODE */
export function installPackages(env: InstallEnv, specs: string[]): Promise<{ ok: boolean; error?: string }> {
  if (specs.length === 0) return Promise.resolve({ ok: true })
  ensureHome(env.homeDir)
  env.log(`装 ${specs.join('、')}`)
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [env.pnpm, 'add', ...specs], {
      cwd: env.homeDir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
    })
    // 只留尾巴：pnpm 把出错原因放在最后几行
    const tail: string[] = []
    const keep = (chunk: Buffer): void => {
      for (const line of String(chunk).split('\n')) {
        if (line.trim() === '') continue
        tail.push(line)
        if (tail.length > 12) tail.shift()
      }
    }
    proc.stdout.on('data', keep)
    proc.stderr.on('data', keep)
    proc.on('error', (err) => resolve({ ok: false, error: String(err) }))
    proc.on('exit', (code) => {
      if (code === 0) {
        env.log(`装好了:${specs.join('、')}`)
        resolve({ ok: true })
        return
      }
      const why = tail.join('\n')
      env.log(`装不上（pnpm 退出码 ${code}）:${why}`)
      resolve({ ok: false, error: `pnpm 退出码 ${code}\n${why}` })
    })
  })
}
