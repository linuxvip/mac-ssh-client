import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createSSHConnection, testSSHConnection, closeSSHConnection, sendSSHData, forwardPort, stopForwarding, getSession } from './ssh'
import { startMonitor, stopMonitor } from './monitor'
import { loadConnections, saveConnections, loadSettings, saveSettings } from './store'
import { sftpList, sftpDownload, sftpUpload, sftpDelete, sftpMkdir, sftpRename, getHomeDir } from './sftp'
import { classifyAndProcess, collectSystemInfo, clearSystemInfoCache, AIConfig } from './ai'

// True once the user confirmed quitting — allows the window to actually close
let quitting = false

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Ask for confirmation before closing (red button, Cmd+Q, menu Quit)
  mainWindow.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    dialog
      .showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['退出', '取消'],
        defaultId: 0,
        cancelId: 1,
        title: '退出确认',
        message: '确定要退出 SSH 客户端吗？',
        detail: '所有活动 SSH 连接将被断开。'
      })
      .then(({ response }) => {
        if (response === 0) {
          quitting = true
          app.quit()
        }
      })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ssh-client.app')

  // macOS copy/paste menu
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'SSH 客户端', submenu: [{ role: 'about', label: '关于' }, { type: 'separator' }, { role: 'quit', label: '退出' }] },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
        { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    window.webContents.on('context-menu', (_e, params) => {
      const menu = Menu.buildFromTemplate([
        { role: 'cut', label: '剪切', enabled: params.editFlags.canCut },
        { role: 'copy', label: '复制', enabled: params.editFlags.canCopy },
        { role: 'paste', label: '粘贴', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' }
      ])
      menu.popup()
    })
  })

  ipcMain.handle('connections:load', () => loadConnections())
  ipcMain.handle('connections:save', (_event, connections) => {
    saveConnections(connections)
  })

  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:save', (_event, settings) => {
    saveSettings(settings)
  })

  // SSH IPC handlers
  ipcMain.handle('ssh:test-connection', async (_event, config) => {
    return testSSHConnection(config)
  })

  ipcMain.handle('ssh:connect', async (event, config) => {
    return createSSHConnection(event, config)
  })

  ipcMain.handle('ssh:disconnect', async (_event, sessionId) => {
    return closeSSHConnection(sessionId)
  })

  ipcMain.on('ssh:data', (_event, sessionId, data) => {
    sendSSHData(sessionId, data)
  })

  ipcMain.handle('ssh:resize', async (_event, sessionId, cols, rows) => {
    const session = getSession(sessionId)
    if (session?.stream) {
      session.stream.setWindow(rows, cols, 0, 0)
    }
  })

  ipcMain.handle('port-forward:start', async (event, sessionId, config) => {
    return forwardPort(event, sessionId, config)
  })

  ipcMain.handle('port-forward:stop', async (_event, forwardId) => {
    return stopForwarding(forwardId)
  })

  // SFTP IPC handlers
  ipcMain.handle('sftp:home', async (_event, sessionId) => {
    return getHomeDir(sessionId)
  })

  ipcMain.handle('sftp:list', async (_event, sessionId, remotePath) => {
    return sftpList(sessionId, remotePath)
  })

  ipcMain.handle('sftp:download', async (event, sessionId, remotePath, fileName) => {
    return sftpDownload(event, sessionId, remotePath, fileName)
  })

  ipcMain.handle('sftp:upload', async (event, sessionId, remoteDir) => {
    return sftpUpload(event, sessionId, remoteDir)
  })

  ipcMain.handle('sftp:delete', async (_event, sessionId, remotePath, isDir) => {
    return sftpDelete(sessionId, remotePath, isDir)
  })

  ipcMain.handle('sftp:mkdir', async (_event, sessionId, remotePath) => {
    return sftpMkdir(sessionId, remotePath)
  })

  ipcMain.handle('sftp:rename', async (_event, sessionId, oldPath, newPath) => {
    return sftpRename(sessionId, oldPath, newPath)
  })

  // AI IPC handlers
  ipcMain.handle('ai:process', async (_event, sessionId: string, input: string) => {
    const settings = loadSettings()
    const aiConfig = settings.ai as AIConfig | undefined
    if (!aiConfig || !aiConfig.apiUrl || !aiConfig.model) {
      return { type: 'error', error: '请先在设置中配置 AI 助手' }
    }
    return classifyAndProcess(sessionId, input, aiConfig)
  })

  ipcMain.handle('ai:system-info', async (_event, sessionId: string) => {
    return collectSystemInfo(sessionId)
  })

  ipcMain.handle('ai:clear-cache', (_event, sessionId: string) => {
    clearSystemInfoCache(sessionId)
  })

  // Monitor IPC handlers
  ipcMain.handle('monitor:start', (event, sessionId) => {
    startMonitor(event.sender, sessionId)
  })

  ipcMain.handle('monitor:stop', (_event, sessionId) => {
    stopMonitor(sessionId)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

