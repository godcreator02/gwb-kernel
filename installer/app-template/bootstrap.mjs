// 安装包外层应用的入口：只加载内核。安装包不带任何插件，插件由 agent 照仓根 INSTALL.md 安装。
import electron from 'electron'

const { app, dialog } = electron

/** 外层应用自己出的错：弹框并以退出码 1 退出，不让进程没有任何提示地结束 */
function fail(message) {
  process.stderr.write(`gwb-app: ${message}\n`)
  dialog.showErrorBox('gwb 启动失败', message)
  app.exit(1)
}

// 不能顶层 await：入口模块求值完 Electron 才触发 ready。内核模块求值时只把启动的后半段（startAfterAppReady）
// 登记到 whenReady，这个 import 完成、本模块也就求值完成，不会和 ready 互相等待
import('@godcreator/gwb-kernel-desktop').catch((err) => {
  fail(`内核启动失败：${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
})
