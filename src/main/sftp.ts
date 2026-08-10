import { Client, SFTPWrapper } from 'ssh2'
import * as fs from 'fs'
import * as path from 'path'
import { IpcMainInvokeEvent, dialog, BrowserWindow } from 'electron'
import { getSession } from './ssh'

export function getHomeDir(sessionId: string): Promise<string> {
  const session = getSession(sessionId)
  if (!session) return Promise.resolve('/')
  return new Promise((resolve) => {
    session.client.exec('echo $HOME', (err, stream) => {
      if (err) return resolve('/')
      let output = ''
      stream.on('data', (data: Buffer) => { output += data.toString() })
      stream.on('close', () => {
        const home = output.trim()
        resolve(home || '/')
      })
    })
  })
}

interface FileItem {
  name: string
  path: string
  isDir: boolean
  size: number
  modTime: number
}

function getSFTP(sessionId: string): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    const session = getSession(sessionId)
    if (!session) return reject(new Error('会话不存在'))
    session.client.sftp((err, sftp) => {
      if (err) {
        if (err.message?.includes('127')) {
          reject(new Error('远端未安装 SFTP 服务 (sftp-server)，尝试使用 exec 模式'))
        } else {
          reject(err)
        }
      } else {
        resolve(sftp)
      }
    })
  })
}

// Fallback: use exec to list files when SFTP is unavailable
function execList(sessionId: string, remotePath: string): Promise<FileItem[]> {
  const session = getSession(sessionId)
  if (!session) return Promise.reject(new Error('会话不存在'))

  return new Promise((resolve, reject) => {
    const quoted = remotePath.replace(/'/g, "'\\''")
    const cmd = `ls -la '${quoted}'`
    session.client.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let output = ''
      stream.on('data', (data: Buffer) => { output += data.toString() })
      stream.stderr.on('data', () => { /* ignore */ })
      stream.on('close', () => {
        console.log('[SFTP-exec] ls output for', remotePath, ':\n', output)
        const items: FileItem[] = []
        const lines = output.split('\n')
        for (const line of lines) {
          if (!line.trim() || line.startsWith('total') || line.startsWith('总用量')) continue
          // ls -la formats vary:
          // GNU:    drwxr-xr-x  2 root root  4096 Mar 25 10:00 dirname  (9+ cols)
          // Busybox: drwxr-xr-x  2 root root  4096 Mar 25 10:00 dirname (9+ cols)
          // Busybox short: drwxr-xr-x  2 root  4096 Mar 25 10:00 dirname (8+ cols, no group)
          // macOS:  drwxr-xr-x  2 root wheel  4096 Mar 25 10:00 dirname  (9+ cols)
          const parts = line.trim().split(/\s+/)
          if (parts.length < 6) continue
          const perms = parts[0]
          if (!/^[dlcbps-]/.test(perms)) continue

          const isDir = perms.startsWith('d')
          const isLink = perms.startsWith('l')

          // Find the filename by detecting the date pattern (Mon DD HH:MM or Mon DD YYYY)
          // Walk from index 4 onward looking for a month abbreviation
          let nameStartIdx = -1
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          for (let i = 4; i < parts.length - 2; i++) {
            if (months.includes(parts[i]) || /^\d{4}-\d{2}-\d{2}$/.test(parts[i])) {
              // Found date start: month day time/year -> name starts 3 columns later
              nameStartIdx = i + 3
              break
            }
          }

          // If no month found, try numeric date format or just take the last token
          if (nameStartIdx < 0 || nameStartIdx >= parts.length) {
            // Fallback: assume name is the last token
            nameStartIdx = parts.length - 1
          }

          const size = parseInt(parts[nameStartIdx - 4]) || parseInt(parts[4]) || 0
          let name = parts.slice(nameStartIdx).join(' ')

          // Handle symlinks: name -> target
          if (isLink) {
            const arrowIdx = name.indexOf(' -> ')
            if (arrowIdx > 0) name = name.substring(0, arrowIdx)
          }

          if (name === '.' || name === '..') continue
          if (!name) continue

          items.push({
            name,
            path: remotePath === '/' ? `/${name}` : `${remotePath}/${name}`,
            isDir: isDir || isLink,
            size,
            modTime: Date.now()
          })
        }
        items.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        resolve(items)
      })
    })
  })
}

export async function sftpList(sessionId: string, remotePath: string): Promise<FileItem[]> {
  let sftp: SFTPWrapper
  try {
    sftp = await getSFTP(sessionId)
  } catch {
    // SFTP not available, fallback to exec
    return execList(sessionId, remotePath)
  }
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      sftp.end()
      if (err) return reject(err)
      const items: FileItem[] = list
        .filter((f) => f.filename !== '.' && f.filename !== '..')
        .map((f) => ({
          name: f.filename,
          path: remotePath === '/' ? `/${f.filename}` : `${remotePath}/${f.filename}`,
          isDir: f.attrs.isDirectory(),
          size: f.attrs.size,
          modTime: f.attrs.mtime * 1000
        }))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      resolve(items)
    })
  })
}

export async function sftpDownload(
  event: IpcMainInvokeEvent,
  sessionId: string,
  remotePath: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { success: false, error: '窗口不存在' }

  const result = await dialog.showSaveDialog(win, {
    defaultPath: fileName,
    title: '保存文件'
  })

  if (result.canceled || !result.filePath) return { success: false, error: '已取消' }

  const localPath = result.filePath!

  // Try SFTP first, fallback to exec cat
  let sftp: SFTPWrapper | null = null
  try {
    sftp = await getSFTP(sessionId)
  } catch {
    // SFTP unavailable, use exec cat
    return execDownload(event, sessionId, remotePath, fileName, localPath)
  }

  return new Promise((resolve) => {
    sftp!.stat(remotePath, (statErr, stats) => {
      const totalSize = statErr ? 0 : stats.size
      let transferred = 0

      const readStream = sftp!.createReadStream(remotePath)
      const writeStream = fs.createWriteStream(localPath)

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        if (totalSize > 0) {
          const pct = Math.round((transferred / totalSize) * 100)
          event.sender.send('sftp:progress', sessionId, 'download', fileName, pct)
        }
      })

      readStream.pipe(writeStream)

      writeStream.on('finish', () => {
        sftp!.end()
        event.sender.send('sftp:progress', sessionId, 'download', fileName, 100)
        resolve({ success: true })
      })

      readStream.on('error', (err) => {
        sftp!.end()
        resolve({ success: false, error: err.message })
      })

      writeStream.on('error', (err) => {
        sftp!.end()
        resolve({ success: false, error: err.message })
      })
    })
  })
}

// Fallback download via exec cat
function execDownload(
  event: IpcMainInvokeEvent,
  sessionId: string,
  remotePath: string,
  fileName: string,
  localPath: string
): Promise<{ success: boolean; error?: string }> {
  const session = getSession(sessionId)
  if (!session) return Promise.resolve({ success: false, error: '会话不存在' })

  return new Promise((resolve) => {
    session.client.exec(`cat ${JSON.stringify(remotePath)}`, (err, stream) => {
      if (err) return resolve({ success: false, error: err.message })

      const writeStream = fs.createWriteStream(localPath)
      let transferred = 0

      stream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        writeStream.write(chunk)
        // No total size available, send bytes transferred
        event.sender.send('sftp:progress', sessionId, 'download', fileName, -1)
      })

      let stderrOutput = ''
      stream.stderr.on('data', (data: Buffer) => { stderrOutput += data.toString() })

      stream.on('close', (code: number) => {
        writeStream.end()
        if (code !== 0) {
          fs.unlinkSync(localPath)
          resolve({ success: false, error: stderrOutput || `退出码: ${code}` })
        } else {
          event.sender.send('sftp:progress', sessionId, 'download', fileName, 100)
          resolve({ success: true })
        }
      })
    })
  })
}

export async function sftpUpload(
  event: IpcMainInvokeEvent,
  sessionId: string,
  remoteDir: string
): Promise<{ success: boolean; error?: string }> {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { success: false, error: '窗口不存在' }

  const result = await dialog.showOpenDialog(win, {
    title: '选择文件上传',
    properties: ['openFile', 'multiSelections']
  })

  if (result.canceled || result.filePaths.length === 0) return { success: false, error: '已取消' }

  // Try SFTP first, fallback to exec
  let sftp: SFTPWrapper | null = null
  let useExec = false
  try {
    sftp = await getSFTP(sessionId)
  } catch {
    useExec = true
  }

  const errors: string[] = []

  for (const localPath of result.filePaths) {
    const fileName = path.basename(localPath)
    const remotePath = remoteDir === '/' ? `/${fileName}` : `${remoteDir}/${fileName}`

    if (useExec) {
      const r = await execUpload(event, sessionId, localPath, remotePath, fileName)
      if (!r.success) errors.push(`${fileName}: ${r.error}`)
    } else {
      await new Promise<void>((resolve) => {
        const stats = fs.statSync(localPath)
        const totalSize = stats.size
        let transferred = 0

        const readStream = fs.createReadStream(localPath)
        const writeStream = sftp!.createWriteStream(remotePath)

        readStream.on('data', (chunk: Buffer) => {
          transferred += chunk.length
          if (totalSize > 0) {
            const pct = Math.round((transferred / totalSize) * 100)
            event.sender.send('sftp:progress', sessionId, 'upload', fileName, pct)
          }
        })

        readStream.pipe(writeStream)

        writeStream.on('close', () => {
          event.sender.send('sftp:progress', sessionId, 'upload', fileName, 100)
          resolve()
        })

        readStream.on('error', (err) => {
          errors.push(`${fileName}: ${err.message}`)
          resolve()
        })

        writeStream.on('error', (err) => {
          errors.push(`${fileName}: ${err.message}`)
          resolve()
        })
      })
    }
  }

  if (sftp) sftp.end()
  if (errors.length > 0) {
    return { success: false, error: errors.join('; ') }
  }
  return { success: true }
}

// Fallback upload via exec: pipe file content through stdin to cat > remotePath
function execUpload(
  event: IpcMainInvokeEvent,
  sessionId: string,
  localPath: string,
  remotePath: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> {
  const session = getSession(sessionId)
  if (!session) return Promise.resolve({ success: false, error: '会话不存在' })

  return new Promise((resolve) => {
    session.client.exec(`cat > ${JSON.stringify(remotePath)}`, (err, stream) => {
      if (err) return resolve({ success: false, error: err.message })

      const stats = fs.statSync(localPath)
      const totalSize = stats.size
      let transferred = 0

      const readStream = fs.createReadStream(localPath)

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        if (totalSize > 0) {
          const pct = Math.round((transferred / totalSize) * 100)
          event.sender.send('sftp:progress', sessionId, 'upload', fileName, pct)
        }
      })

      readStream.pipe(stream)

      stream.on('close', (code: number) => {
        if (code !== 0) {
          resolve({ success: false, error: `退出码: ${code}` })
        } else {
          event.sender.send('sftp:progress', sessionId, 'upload', fileName, 100)
          resolve({ success: true })
        }
      })

      readStream.on('error', (e) => {
        stream.close()
        resolve({ success: false, error: e.message })
      })
    })
  })
}

export async function sftpDelete(
  sessionId: string,
  remotePath: string,
  isDir: boolean
): Promise<{ success: boolean; error?: string }> {
  let sftp: SFTPWrapper | null = null
  try {
    sftp = await getSFTP(sessionId)
  } catch {
    return execCmd(sessionId, isDir ? `rm -rf ${JSON.stringify(remotePath)}` : `rm -f ${JSON.stringify(remotePath)}`)
  }
  return new Promise((resolve) => {
    const cb = (err: Error | undefined) => {
      sftp!.end()
      if (err) resolve({ success: false, error: err.message })
      else resolve({ success: true })
    }
    if (isDir) sftp.rmdir(remotePath, cb)
    else sftp.unlink(remotePath, cb)
  })
}

export async function sftpMkdir(
  sessionId: string,
  remotePath: string
): Promise<{ success: boolean; error?: string }> {
  let sftp: SFTPWrapper | null = null
  try {
    sftp = await getSFTP(sessionId)
  } catch {
    return execCmd(sessionId, `mkdir -p ${JSON.stringify(remotePath)}`)
  }
  return new Promise((resolve) => {
    sftp!.mkdir(remotePath, (err) => {
      sftp!.end()
      if (err) resolve({ success: false, error: err.message })
      else resolve({ success: true })
    })
  })
}

export async function sftpRename(
  sessionId: string,
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; error?: string }> {
  let sftp: SFTPWrapper | null = null
  try {
    sftp = await getSFTP(sessionId)
  } catch {
    return execCmd(sessionId, `mv ${JSON.stringify(oldPath)} ${JSON.stringify(newPath)}`)
  }
  return new Promise((resolve) => {
    sftp!.rename(oldPath, newPath, (err) => {
      sftp!.end()
      if (err) resolve({ success: false, error: err.message })
      else resolve({ success: true })
    })
  })
}

// Generic exec helper for simple commands
function execCmd(sessionId: string, cmd: string): Promise<{ success: boolean; error?: string }> {
  const session = getSession(sessionId)
  if (!session) return Promise.resolve({ success: false, error: '会话不存在' })

  return new Promise((resolve) => {
    session.client.exec(cmd, (err, stream) => {
      if (err) return resolve({ success: false, error: err.message })
      let stderr = ''
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
      stream.on('close', (code: number) => {
        if (code !== 0) resolve({ success: false, error: stderr || `退出码: ${code}` })
        else resolve({ success: true })
      })
    })
  })
}
