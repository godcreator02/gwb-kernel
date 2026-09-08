import electron from 'electron'

const { contextBridge, ipcRenderer } = electron

/**
 * 桥的浏览器那半。命令一条、事件一条、宿主讣告一条，外加日志那两条。
 *
 * 日志单开一组、不混进 `onEvent`：它有三路根本不来自任何件，量级也比件的事件大一截。
 */
contextBridge.exposeInMainWorld('gwb', {
  command: (command: string, args?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('gwb:command', { command, args }),
  onEvent: (cb: (payload: unknown) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on('gwb:event', listener)
    return () => ipcRenderer.off('gwb:event', listener)
  },
  /** 宿主没了。一次性事件，页面据此把整页换成崩溃页 */
  onHostExit: (cb: (code: number | null) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, code: number | null): void => cb(code)
    ipcRenderer.on('gwb:host-exit', listener)
    return () => ipcRenderer.off('gwb:host-exit', listener)
  },
  logs: {
    /** 开机到此刻。取之前先 `on` 订上，两段按 `seq` 合并 */
    backlog: (): Promise<unknown> => ipcRenderer.invoke('gwb:log-backlog'),
    /** 之后的，**一批一批**地来 */
    on: (cb: (batch: unknown) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, batch: unknown): void => cb(batch)
      ipcRenderer.on('gwb:log', listener)
      return () => ipcRenderer.off('gwb:log', listener)
    },
  },
})
