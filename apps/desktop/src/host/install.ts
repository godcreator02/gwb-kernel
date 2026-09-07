import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 装机：把包名转发给 pnpm，装进 home 的 node_modules。registry 归 pnpm 按 .npmrc 决定。
 * 装不上就回一句原因，不还原、不对账、不重试。取舍见文档站。
 */

/** 首启装什么。空表就只把 home 建出来 */
export const RECOMMENDED: readonly string[] = []

/** home 得先是个包才装得进东西。已存在就不动 */
export function ensureHomeManifest(homeDir: string): void {
  const file = path.join(homeDir, 'package.json')
  if (fs.existsSync(file)) return
  fs.mkdirSync(homeDir, { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify({ name: 'gwb-home', private: true }, null, 2)}\n`, 'utf8')
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
  ensureHomeManifest(env.homeDir)
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
