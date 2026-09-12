// 桥的浏览器那半：window.gwb 三个函数，再没别的。沙箱里跑，所以是 CJS。形状钉在词汇表包的 GwbWindowApi
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gwb', {
  command: (command, args) => ipcRenderer.invoke('gwb:command', command, args),
  on: (cb) => {
    const listener = (_event, payload) => cb(payload)
    ipcRenderer.on('gwb:event', listener)
    return () => ipcRenderer.off('gwb:event', listener)
  },
  onShell: (cb) => {
    // 收到的是 { url, imports, report }：外壳地址、页面级 importmap、只读现状（无外壳时页面画它）
    const listener = (_event, shell) => cb(shell)
    ipcRenderer.on('gwb:shell', listener)
    // 订上就问一次当前值，免得件在页面起来之前就 setShell 过了
    ipcRenderer.send('gwb:hello')
    return () => ipcRenderer.off('gwb:shell', listener)
  },
})
