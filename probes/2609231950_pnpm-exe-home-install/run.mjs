// 场景与问题见 README.md。所有现场建在系统临时目录下，不碰任何 gwb home。
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const bundledExe = path.join(path.dirname(require.resolve('@pnpm/exe.win32-x64/package.json')), 'pnpm.exe')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-pnpm-probe-'))

const TEMPLATE_DEPENDENCIES = {
  '@godcreator/gwb-commands': '0.4.6',
  '@godcreator/gwb-plugin-manager': '0.7.1',
}
const TEMPLATE_CORDIS_YML = '- id: commands\n  name: "@godcreator/gwb-commands"\n- id: plugin-manager\n  name: "@godcreator/gwb-plugin-manager"\n'

// 照内核将来的启动方式：环境原样传下去，只去掉 ELECTRON_RUN_AS_NODE；npm run 注入的 npm_* 也去掉，内核进程里没有它们
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key !== 'ELECTRON_RUN_AS_NODE' && !key.toLowerCase().startsWith('npm_')),
)

function report(scenario, fields) {
  console.log(JSON.stringify({ scenario, ...fields }))
}

function tailOf(text, lines = 12) {
  return text.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(-lines)
}

/** 运行一次 pnpm；killWhen 返回 true 时整棵进程树强杀 */
function runPnpm(exe, args, cwd, killWhen) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(exe, args, { cwd, env: childEnv, windowsHide: true })
    let output = ''
    let killed = false
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    const poll = killWhen && setInterval(() => {
      if (!killed && killWhen(Date.now() - started)) {
        killed = true
        try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
      }
    }, 50)
    child.on('close', (code) => {
      if (poll) clearInterval(poll)
      resolve({ code, killed, ms: Date.now() - started, tail: tailOf(output) })
    })
  })
}

function makeHome(name, dependencies) {
  const home = path.join(root, name)
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(path.join(home, 'package.json'), JSON.stringify({ name: 'gwb-home', private: true, dependencies }, null, 2) + '\n')
  fs.writeFileSync(path.join(home, 'cordis.yml'), TEMPLATE_CORDIS_YML)
  return home
}

/** 内核将来的判据：package.json 列的包，node_modules 下有没有目录 */
function missingPackages(home) {
  const manifest = JSON.parse(fs.readFileSync(path.join(home, 'package.json'), 'utf8'))
  return Object.keys(manifest.dependencies ?? {}).filter((name) => !fs.existsSync(path.join(home, 'node_modules', ...name.split('/'))))
}

function pnpmExeDirsIn(home) {
  const store = path.join(home, 'node_modules', '.pnpm')
  if (!fs.existsSync(store)) return []
  return fs.readdirSync(store).filter((dir) => dir.startsWith('@pnpm+exe') || dir.startsWith('pnpm@'))
}

function homeExeOf(home, version) {
  return path.join(home, 'node_modules', '.pnpm', `@pnpm+exe.win32-x64@${version}`, 'node_modules', '@pnpm', 'exe.win32-x64', 'pnpm.exe')
}

/** 上一种办法没补回来时链接本来就不在，跳过 */
function removeLink(target) {
  try { fs.lstatSync(target) } catch { return }
  try { fs.unlinkSync(target) } catch { fs.rmdirSync(target) }
}

report('environment', {
  root,
  node: process.version,
  bundledExe,
  bundledVersion: execFileSync(bundledExe, ['--version'], { env: childEnv }).toString().trim(),
})

// 一：只拷 pnpm.exe 一个文件，在只有模板两个文件的目录里 pnpm install
const lonelyBin = path.join(root, 'bin')
fs.mkdirSync(lonelyBin)
const lonelyExe = path.join(lonelyBin, 'pnpm.exe')
fs.copyFileSync(bundledExe, lonelyExe)
report('1-exe-alone-files', { files: fs.readdirSync(lonelyBin) })

const coldHome = makeHome('home-cold', TEMPLATE_DEPENDENCIES)
const cold = await runPnpm(lonelyExe, ['install', '--store-dir', path.join(root, 'store-cold')], coldHome)
report('1a-cold-store', { ...cold, missing: missingPackages(coldHome), homeFiles: fs.readdirSync(coldHome) })

const warmHome = makeHome('home-warm', TEMPLATE_DEPENDENCIES)
const warm = await runPnpm(lonelyExe, ['install'], warmHome)
report('1b-default-store', { ...warm, missing: missingPackages(warmHome) })

// 二：某个包的目录没了，三种再装的办法各试一次
const commandsLink = path.join(warmHome, 'node_modules', '@godcreator', 'gwb-commands')
const modulesYaml = path.join(warmHome, 'node_modules', '.modules.yaml')
for (const [attempt, args, before] of [
  ['2a-plain-install', ['install'], () => {}],
  ['2b-install-force', ['install', '--force'], () => {}],
  ['2c-delete-modules-yaml-then-install', ['install'], () => fs.rmSync(modulesYaml)],
]) {
  removeLink(commandsLink)
  const missingBefore = missingPackages(warmHome)
  before()
  const result = await runPnpm(lonelyExe, args, warmHome)
  report(attempt, { missingBefore, ...result, missing: missingPackages(warmHome) })
}

// 三：冷存储装到一半强杀，看判据能不能发现、再装一次能不能补齐
for (const killAfterMs of [300, 600, 900, 1200, 1600, 2000]) {
  const home = makeHome(`home-kill-${killAfterMs}`, TEMPLATE_DEPENDENCIES)
  const store = path.join(root, `store-kill-${killAfterMs}`)
  const interrupted = await runPnpm(lonelyExe, ['install', '--store-dir', store], home, (elapsed) => elapsed >= killAfterMs)
  const afterKill = {
    nodeModules: fs.existsSync(path.join(home, 'node_modules')),
    modulesYaml: fs.existsSync(path.join(home, 'node_modules', '.modules.yaml')),
    lockfile: fs.existsSync(path.join(home, 'pnpm-lock.yaml')),
    missing: missingPackages(home),
  }
  const again = await runPnpm(lonelyExe, ['install', '--store-dir', store], home)
  report(`3-kill-after-${killAfterMs}ms`, {
    interrupted: { code: interrupted.code, killed: interrupted.killed, ms: interrupted.ms },
    afterKill,
    again: { ...again, missing: missingPackages(home) },
  })
}

// 四：home 里的 pnpm 升级 / 降级自己
for (const [variant, dependencyName] of [['4a-pnpm-package', 'pnpm'], ['4b-exe-package', '@pnpm/exe.win32-x64']]) {
  const home = makeHome(`home-${variant}`, { [dependencyName]: '12.4.1' })
  const first = await runPnpm(lonelyExe, ['install'], home)
  const oldExe = homeExeOf(home, '12.4.1')
  report(`${variant}-install`, { ...first, missing: missingPackages(home), exeDirs: pnpmExeDirsIn(home), homeExeExists: fs.existsSync(oldExe) })
  if (!fs.existsSync(oldExe)) continue

  const upgrade = await runPnpm(oldExe, ['add', `${dependencyName}@12.4.2`], home)
  const newExe = homeExeOf(home, '12.4.2')
  report(`${variant}-upgrade-running-12.4.1`, {
    ...upgrade,
    dependencies: JSON.parse(fs.readFileSync(path.join(home, 'package.json'), 'utf8')).dependencies,
    exeDirs: pnpmExeDirsIn(home),
    oldExeStillThere: fs.existsSync(oldExe),
    newExeExists: fs.existsSync(newExe),
  })
  if (!fs.existsSync(newExe)) continue

  const downgrade = await runPnpm(newExe, ['add', `${dependencyName}@12.4.1`], home)
  report(`${variant}-downgrade-running-12.4.2`, {
    ...downgrade,
    dependencies: JSON.parse(fs.readFileSync(path.join(home, 'package.json'), 'utf8')).dependencies,
    exeDirs: pnpmExeDirsIn(home),
    runningExeStillThere: fs.existsSync(newExe),
  })
}

report('done', { root })
