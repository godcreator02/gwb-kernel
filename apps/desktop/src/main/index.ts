import electron from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostCommand, killHost, startHost, type Host } from './host-process'
import { handleAsset } from './asset'
import { teeToFile } from './log-file'
import { logBacklog, mainLog, rendererLog, setLogSink } from './logs'

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

/**
 * 用哪个 home，`GWB_HOME` 说了算，不给就是 `default`。
 * 名字要能当目录名——不卡住的话 `GWB_HOME=../../x` 就跳出 homes/ 了。
 */
function homeName(): string {
  const raw = process.env.GWB_HOME ?? 'default'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw)) {
    // 这条错发生在 teeToFile 挂上之前（它要 logDir，logDir 要这个函数的结果），劫持与
    // 窗格都还不在——mainLog 进缓冲、裸 stderr 进终端，两处都写一句才算把话说到了
    const message = `GWB_HOME ${JSON.stringify(raw)} 不合规。一律 kebab-case（小写字母、数字、单连字符分段）。`
    mainLog('error', 'gwb', `起不来：${message}`)
    process.stderr.write(`[gwb] 起不来：${message}\n`)
    throw new Error(message)
  }
  return raw
}

// getPath 在 ready 之前就能用；落盘要趁早。
// 这一行是 home 路径的**唯一真源**：日志、gwb:// 的位、传给宿主的 GWB_DATA_DIR 全从它派生
const dataDir = path.join(app.getPath('userData'), 'homes', homeName())
/** 日志目录名的**唯一真源**。宿主经环境变量拿它，件经 `kernel.info` 拿——都不自己拼 */
const logDir = path.join(dataDir, 'logs')
teeToFile(logDir)

let host: Host | null = null
let win: electron.BrowserWindow | null = null

ipcMain.handle('gwb:command', (_event, payload: { command: string; args?: unknown }) => {
  if (host === null) {
    // 渲染层拿得到这句回执,但「谁在宿主没起来的时候调了什么」日志里也该有——
    // 比如件还没挂完界面就发了命令
    mainLog('warn', 'gwb', `宿主还没起来，命令 ${payload.command} 收了但没处送`)
    return Promise.resolve({ ok: false, error: '宿主没起来' })
  }
  return hostCommand(host, payload)
})

/**
 * 日志的历史段。**不走命令通道**：缓冲就在这个进程里，而命令要绕到宿主再原路背回来
 * ——宿主一挂命令全废，那恰恰是最需要翻历史的时候。
 */
ipcMain.handle('gwb:log-backlog', () => logBacklog())

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    title: 'gwb-kernel',
    // 菜单栏平时收起，Alt 临时唤出；Ctrl+Shift+I 等默认加速键随菜单保留
    autoHideMenuBar: true,
    // 窗底跟暗色主题的页面底（gwb-tokens .dark 的 --background）对齐。不设的话 Electron
    // 默认白底，最小化恢复/首次画出前原生层先闪白。亮色模式下这一下会是暗闪，比白闪轻。
    backgroundColor: '#151518',
    webPreferences: {
      preload: path.join(here, '../preload/index.mjs'),
      contextIsolation: true,
      // ESM preload 需要；contextIsolation 仍开着
      sandbox: false,
    },
  })
  // 渲染层的 console 转终端，顺带进缓冲——它是四路日志里的一路
  win.webContents.on('console-message', (e) => rendererLog(e.level, e.message))
  // 窗有了才推得动。在这之前的条目一条没丢，都在缓冲里等着 backlog 取
  const target = win.webContents
  setLogSink((batch) => target.send('gwb:log', batch))
  win.on('closed', () => setLogSink(null))
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
      logDir,
      version: app.getVersion(),
      onEvent: (payload) => win?.webContents.send('gwb:event', payload),
    })
    await createWindow()
  })
  .catch((err: unknown) => {
    // 失败即失败：没有兜底页
    mainLog('error', 'gwb', `起不来：${String(err)}`)
    app.exit(1)
  })

app.on('before-quit', () => {
  if (host !== null) killHost(host)
})
app.on('window-all-closed', () => app.quit())
