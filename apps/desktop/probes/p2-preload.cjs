// 探针二的 preload：只给页面一条把结果送回主进程的路
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('probe', {
  report: (value) => ipcRenderer.send('probe:report', value),
})
