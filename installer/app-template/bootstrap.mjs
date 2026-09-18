// 应用壳入口：只起内核。安装包不带任何插件，装机由 agent 照仓根 INSTALL.md 做（见 SPEC.md）。
import electron from 'electron'

const { app, dialog } = electron

/** 壳里出的事自己兜：弹框 + 退出码 1，别让进程静默死 */
function fail(message) {
  process.stderr.write(`gwb-app: ${message}\n`)
  dialog.showErrorBox('gwb 起不来', message)
  app.exit(1)
}

// 不顶层 await：入口模块求值完 Electron 才发 ready。内核模块自评值（main() 只注册进
// whenReady），这个 import 完成本模块求值即完成，不会与 ready 互等——内核 main.ts 里那面墙
// 的同款绕法
import('@godcreator/gwb-kernel-desktop').catch((err) => {
  fail(`内核起不来：${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
})
