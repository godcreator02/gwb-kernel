// 应用壳入口：先铺种子，再起内核。这段住 installer/——「首启装件」不进 apps/desktop 是
// 硬边界（见 SPEC.md）。种子只在「没点名 home（落 default）且 default 还不存在」时落：
// 点名了尊重点名的世界，已存在的 default 一个字节不动（装机人自己的台照旧）。
import fs from 'node:fs'
import path from 'node:path'
import electron from 'electron'
import { decideSeed, pickTemplate } from './lib/seed-core.mjs'

const { app, dialog } = electron

/** 壳里出的事自己兜：弹框 + 退出码 1，别让进程静默死 */
function fail(message) {
  process.stderr.write(`gwb-app: ${message}\n`)
  dialog.showErrorBox('gwb 起不来', message)
  app.exit(1)
}

try {
  const target = decideSeed({
    homeArg: process.env.GWB_HOME,
    defaultHome: path.join(app.getPath('appData'), 'gwb-kernel', 'homes', 'default'),
    exists: (p) => fs.existsSync(p),
  })
  if (target !== undefined) {
    // 打包后住 resources/seed-home/payload（extraResources 垫过层）；开发态（electron build/app）
    // 退回 installer/seed（build/app 上两级）
    const template = pickTemplate(
      [
        path.join(process.resourcesPath, 'seed-home', 'payload'),
        path.join(app.getAppPath(), '..', '..', 'seed'),
      ],
      (p) => fs.existsSync(p),
    )
    if (template === undefined) {
      process.stderr.write('gwb-app: 找不到种子模板，default home 将由内核铺成空世界\n')
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.cpSync(template, target, { recursive: true })
    }
  }
} catch (err) {
  fail(`铺种子失败：${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
}

// 不顶层 await：入口模块求值完 Electron 才发 ready。内核模块自评值（main() 只注册进
// whenReady），这个 import 完成本模块求值即完成，不会与 ready 互等——内核 main.ts 里那面墙
// 的同款绕法
import('@godcreator/gwb-kernel-desktop').catch((err) => {
  fail(`内核起不来：${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
})
