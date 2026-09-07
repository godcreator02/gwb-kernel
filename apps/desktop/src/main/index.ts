import electron from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostCommand, killHost, startHost, type Host } from './host-process'
import { handleAsset } from './asset'
import { teeToFile } from './log-file'

/**
 * GUI 主进程：开一扇窗、起一个宿主、把两头接上。
 * 内核的「载体」与「桥」就在这个文件加 host-process.ts / asset.ts 里。
 */

const { app, BrowserWindow, ipcMain, protocol } = electron
const here = path.dirname(fileURLToPath(import.meta.url))

// 必须在 app ready 之前、模块顶层声明
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'gwb',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])

// getPath 在 ready 之前就能用；落盘要趁早
const dataDir = path.join(app.getPath('userData'), 'home')
teeToFile(path.join(dataDir, 'gwb-kernel.log'))

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
      // ESM preload 需要；contextIsolation 仍开着
      sandbox: false,
    },
  })
  // 渲染层的 console 转终端
  win.webContents.on('console-message', (e) => console.error(`[renderer] ${e.message}`))
  if (process.env.ELECTRON_RENDERER_URL !== undefined) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(path.join(here, '../renderer/index.html'))
}

void app
  .whenReady()
  .then(async () => {
    // 处理器随进程存亡，不必管生命周期
    protocol.handle('gwb', (request) => handleAsset(path.join(dataDir, 'node_modules'), request))
    host = await startHost({
      dataDir,
      version: app.getVersion(),
      onEvent: (payload) => win?.webContents.send('gwb:event', payload),
    })
    await createWindow()
  })
  .catch((err: unknown) => {
    // 失败即失败：没有兜底页
    console.error(`[gwb] 起不来：${String(err)}`)
    app.exit(1)
  })

app.on('before-quit', () => {
  if (host !== null) killHost(host)
})
app.on('window-all-closed', () => app.quit())
