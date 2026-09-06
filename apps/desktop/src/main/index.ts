import electron from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostCommand, killHost, startHost, type Host } from './host-process'

/**
 * GUI 主进程：开一扇窗、起一个宿主、把两头接上。
 * 内核的「载体」与「桥」就在这个文件加 host-process.ts 里，别的都不该往这儿长。
 */

const { app, BrowserWindow, ipcMain } = electron
const here = path.dirname(fileURLToPath(import.meta.url))

let host: Host | null = null
let win: electron.BrowserWindow | null = null

ipcMain.handle('gwb:command', (_event, payload: { command: string; args?: unknown }) => {
  if (host === null) return Promise.resolve({ ok: false, error: '宿主没起来' })
  return hostCommand(host, payload)
})

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    title: 'gwb-kernel',
    webPreferences: {
      preload: path.join(here, '../preload/index.mjs'),
      contextIsolation: true,
      // ESM preload 需要；隔离仍开着，渲染层只摸得到桥暴露的那两条
      sandbox: false,
    },
  })
  // 渲染层的 console 转终端。没有它，页面里发生的一切都是黑盒——这是调试的底线，
  // 不是日志功能:不缓冲、不分级、不进界面
  win.webContents.on('console-message', (e) => console.error(`[renderer] ${e.message}`))
  if (process.env.ELECTRON_RENDERER_URL !== undefined) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(path.join(here, '../renderer/index.html'))
}

void app
  .whenReady()
  .then(async () => {
    host = await startHost({
      dataDir: path.join(app.getPath('userData'), 'home'),
      version: app.getVersion(),
      onEvent: (payload) => win?.webContents.send('gwb:event', payload),
    })
    await createWindow()
  })
  .catch((err: unknown) => {
    // 失败即失败:没有兜底页，原因留在终端里，出路走命令行
    console.error(`[gwb] 起不来：${String(err)}`)
    app.exit(1)
  })

app.on('before-quit', () => {
  if (host !== null) killHost(host)
})
app.on('window-all-closed', () => app.quit())
