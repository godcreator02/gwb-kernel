// 页面上的 window.gwb，形状见包根导出的 GwbWindowApi（src/api.ts）；preload 在沙箱里运行，只能是 CJS
const { contextBridge, ipcRenderer } = require('electron')

// 同一 Document 中的映射不可撤销或改绑。并发准备串行取新快照，失败不毒化后续请求。
const appliedImports = new Map()
let preparation = Promise.resolve()

async function applyImports(required) {
  const imports = await ipcRenderer.invoke('gwb:imports')
  for (const name of required) {
    if (!Object.hasOwn(imports, name)) throw new Error(`浏览器模块 ${name} 尚未登记；先等待提供方就绪`)
  }
  for (const [name, url] of appliedImports) {
    if (imports[name] !== url) throw new Error(`GWB_IMPORTS_RELOAD_REQUIRED: 浏览器模块 ${name} 已改变或撤销，需要整页重载`)
  }
  const added = Object.fromEntries(Object.entries(imports).filter(([name]) => !appliedImports.has(name)))
  if (Object.keys(added).length === 0) return
  const script = document.createElement('script')
  script.type = 'importmap'
  script.textContent = JSON.stringify({ imports: added })
  document.head.appendChild(script)
  for (const [name, url] of Object.entries(added)) appliedImports.set(name, url)
}

function prepareImports(required = []) {
  const result = preparation.then(() => applyImports(required))
  preparation = result.catch(() => {})
  return result
}

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

contextBridge.exposeInMainWorld('gwb', {
  prepareImports,
  command: (command, args) => ipcRenderer.invoke('gwb:command', command, args),
  on: (callback) => subscribe('gwb:event', callback),
  onShell: (callback) => {
    const unsubscribe = subscribe('gwb:shell', callback)
    // 订阅后马上问一次当前值：外壳插件可能在页面就位之前就调过 setShell
    ipcRenderer.send('gwb:hello')
    return unsubscribe
  },
})
