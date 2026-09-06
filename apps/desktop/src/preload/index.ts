import electron from 'electron'

const { contextBridge, ipcRenderer } = electron

/** 桥的浏览器那半:命令一条、事件一条,再没别的 */
contextBridge.exposeInMainWorld('gwb', {
  command: (command: string, args?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('gwb:command', { command, args }),
  onEvent: (cb: (payload: unknown) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on('gwb:event', listener)
    return () => ipcRenderer.off('gwb:event', listener)
  },
})
