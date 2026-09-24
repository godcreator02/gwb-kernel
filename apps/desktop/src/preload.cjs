// 页面上的 window.gwb，形状见词汇表包的 GwbWindowApi；preload 在沙箱里运行，只能是 CJS
const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

contextBridge.exposeInMainWorld('gwb', {
  command: (command, args) => ipcRenderer.invoke('gwb:command', command, args),
  on: (callback) => subscribe('gwb:event', callback),
  onShell: (callback) => {
    const unsubscribe = subscribe('gwb:shell', callback)
    // 订阅后马上问一次当前值：外壳插件可能在页面就位之前就调过 setShell
    ipcRenderer.send('gwb:hello')
    return unsubscribe
  },
})
