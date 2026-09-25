import electron from 'electron'
import { pathToFileURL } from 'node:url'
import { homePathFor, kernelEntryFor } from './launch-plan.js'

const { app, dialog } = electron

/** 弹框并以退出码 1 退出，不让进程没有任何提示地结束 */
function fail(message: string): void {
  process.stderr.write(`gwb-launcher: ${message}\n`)
  dialog.showErrorBox('gwb 启动失败', message)
  app.exit(1)
}

const electronVersion = process.versions.electron
if (electronVersion === undefined) throw new Error('启动器只能在 Electron 里运行')

const homeDir = homePathFor(process.env.GWB_HOME ?? 'default', app.getPath('appData'))
// 内核启动时按同一条规则再选一次 home；给它绝对路径，两边一定是同一个目录
process.env.GWB_HOME = homeDir

const kernel = kernelEntryFor(homeDir, electronVersion)
if (kernel.ok) {
  // 不能顶层 await：入口模块求值完 Electron 才触发 ready，内核模块求值时只把启动注册到 whenReady
  import(pathToFileURL(kernel.entryFile).href).catch((err: unknown) => {
    fail(`内核启动失败：${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
  })
} else {
  fail(kernel.message)
}
