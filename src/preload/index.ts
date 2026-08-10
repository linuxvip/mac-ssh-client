import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  ssh: {
    testConnection: (config: object) => ipcRenderer.invoke('ssh:test-connection', config),
    connect: (config: object) => ipcRenderer.invoke('ssh:connect', config),
    disconnect: (sessionId: string) => ipcRenderer.invoke('ssh:disconnect', sessionId),
    send: (sessionId: string, data: string) => ipcRenderer.send('ssh:data', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:resize', sessionId, cols, rows),
    onOutput: (sessionId: string, cb: (data: string) => void) => {
      const handler = (_: unknown, data: string) => cb(data)
      ipcRenderer.on(`ssh:output:${sessionId}`, handler)
      return () => ipcRenderer.off(`ssh:output:${sessionId}`, handler)
    },
    onClosed: (sessionId: string, cb: () => void) => {
      const handler = () => cb()
      ipcRenderer.on(`ssh:closed:${sessionId}`, handler)
      return () => ipcRenderer.off(`ssh:closed:${sessionId}`, handler)
    }
  },
  portForward: {
    start: (sessionId: string, config: object) =>
      ipcRenderer.invoke('port-forward:start', sessionId, config),
    stop: (forwardId: string) => ipcRenderer.invoke('port-forward:stop', forwardId),
    onActive: (cb: (forwardId: string, config: object) => void) => {
      const handler = (_: unknown, forwardId: string, config: object) => cb(forwardId, config)
      ipcRenderer.on('port-forward:active', handler)
      return () => ipcRenderer.off('port-forward:active', handler)
    }
  },
  connections: {
    load: () => ipcRenderer.invoke('connections:load'),
    save: (data: object) => ipcRenderer.invoke('connections:save', data)
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: object) => ipcRenderer.invoke('settings:save', settings)
  },
  sftp: {
    home: (sessionId: string) =>
      ipcRenderer.invoke('sftp:home', sessionId),
    list: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:list', sessionId, remotePath),
    download: (sessionId: string, remotePath: string, fileName: string) =>
      ipcRenderer.invoke('sftp:download', sessionId, remotePath, fileName),
    upload: (sessionId: string, remoteDir: string) =>
      ipcRenderer.invoke('sftp:upload', sessionId, remoteDir),
    delete: (sessionId: string, remotePath: string, isDir: boolean) =>
      ipcRenderer.invoke('sftp:delete', sessionId, remotePath, isDir),
    mkdir: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath),
    rename: (sessionId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', sessionId, oldPath, newPath),
    onProgress: (cb: (sessionId: string, type: string, fileName: string, pct: number) => void) => {
      const handler = (_: unknown, sessionId: string, type: string, fileName: string, pct: number) =>
        cb(sessionId, type, fileName, pct)
      ipcRenderer.on('sftp:progress', handler)
      return () => ipcRenderer.off('sftp:progress', handler)
    }
  },
  ai: {
    process: (sessionId: string, input: string) =>
      ipcRenderer.invoke('ai:process', sessionId, input),
    getSystemInfo: (sessionId: string) =>
      ipcRenderer.invoke('ai:system-info', sessionId),
    clearCache: (sessionId: string) =>
      ipcRenderer.invoke('ai:clear-cache', sessionId)
  },
  monitor: {
    start: (sessionId: string) => ipcRenderer.invoke('monitor:start', sessionId),
    stop: (sessionId: string) => ipcRenderer.invoke('monitor:stop', sessionId),
    onData: (cb: (sessionId: string, data: any) => void) => {
      const handler = (_: unknown, sessionId: string, data: any) => cb(sessionId, data)
      ipcRenderer.on('monitor:data', handler)
      return () => ipcRenderer.off('monitor:data', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
