const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

let mapping = { 'probe/runtime': pathToFileURL(path.join(__dirname, 'runtime.mjs')).href }
ipcMain.handle('gwb:imports', () => mapping)
const timeout = setTimeout(() => { console.error('PROBE_TIMEOUT'); app.exit(1) }, 20000)
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs') } })
  await win.loadFile(path.join(__dirname, 'page.html'))
  const result = await win.webContents.executeJavaScript(`(async () => {
    await window.gwb.prepareImports(['probe/runtime'])
    const first = await import('probe/runtime')
    await Promise.all([window.gwb.prepareImports(), window.gwb.prepareImports()])
    const second = await import('probe/runtime')
    return { value: first.value, same: first === second, maps: document.querySelectorAll('script[type="importmap"]').length }
  })()`)
  if (result.value !== 42 || !result.same || result.maps !== 1) throw new Error(JSON.stringify(result))
  mapping = { 'probe/runtime': pathToFileURL(path.join(__dirname, 'other.mjs')).href }
  const refusal = await win.webContents.executeJavaScript(`window.gwb.prepareImports().then(() => 'unexpected success', e => e.message)`)
  if (!refusal.includes('重载')) throw new Error(refusal)
  console.log(JSON.stringify({ electron: process.versions.electron, chromium: process.versions.chrome, ...result, refusal }))
  clearTimeout(timeout)
  app.exit(0)
}).catch(error => { console.error(error); clearTimeout(timeout); app.exit(1) })
