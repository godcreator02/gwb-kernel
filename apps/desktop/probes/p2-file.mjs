// 探针二：loadFile 起的页面能不能直接吃 home 下的 file://（动态 import、样式表、importmap、fetch、JSON 模块）。
// 主进程零资源代码：不注册协议、不解析 exports。页面把五个断言的结果经 IPC 送回，写到 p2-file.out.json。
import electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const { app, BrowserWindow, ipcMain } = electron
const here = path.dirname(fileURLToPath(import.meta.url))
const pkgDir = path.resolve(here, 'homes', 'probe1', 'node_modules', 'gwb-probe-pane')
const outFile = path.join(here, 'p2-file.out.json')
const out = { console: [] }

function finish(extra) {
  Object.assign(out, extra)
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
  app.exit(0)
}

void app.whenReady().then(async () => {
  ipcMain.on('probe:report', (_e, value) => finish({ ok: true, page: value }))
  setTimeout(() => finish({ ok: false, error: 'page never reported (15s)' }), 15000)
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(here, 'p2-preload.cjs'), contextIsolation: true },
  })
  win.webContents.on('console-message', (e) => out.console.push(`${e.level} ${e.message}`))
  await win.loadFile(path.join(here, 'p2-file', 'index.html'), {
    query: { pkg: pathToFileURL(pkgDir + path.sep).href },
  })
})
