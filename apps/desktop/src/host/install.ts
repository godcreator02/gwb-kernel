import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 装机:把一个包名装进 home 的 node_modules。转发 pnpm,registry 归它按 .npmrc 决定
 * ——本地还是远端不是内核该管的事。
 * 装不上就是装不上:回一句原因,不还原、不对账、不重试。
 */

/** 首启装什么。空表就只把 home 建出来——有了要默认装的件再往里填 */
export const RECOMMENDED: readonly string[] = []

/** home 得先是个包才装得进东西。已存在就不动——那个文件归用户 */
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
  /** 自带的 pnpm 入口脚本;主进程按两态算好了传下来 */
  pnpm: string
  log: (line: string) => void
}

/** 跑一趟 pnpm add。子进程是 electron 当 node 使,所以要 ELECTRON_RUN_AS_NODE */
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
    // 留尾巴就够:pnpm 把出错原因放在最后几行,整篇留着只会淹掉它
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
