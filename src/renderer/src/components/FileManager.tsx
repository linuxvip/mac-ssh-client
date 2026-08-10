import React, { useState, useEffect, useCallback } from 'react'

interface FileItem {
  name: string
  path: string
  isDir: boolean
  size: number
  modTime: number
}

interface Props {
  sessionId: string
  onClose: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function FileManager({ sessionId, onClose }: Props): JSX.Element {
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pathInput, setPathInput] = useState('/')
  const [progress, setProgress] = useState<{ type: string; fileName: string; pct: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null)
  const [showMkdir, setShowMkdir] = useState(false)
  const [newDirName, setNewDirName] = useState('')
  const [showRename, setShowRename] = useState<FileItem | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true)
    setError('')
    try {
      const list = await window.api.sftp.list(sessionId, dirPath)
      setFiles(list)
      setCurrentPath(dirPath)
      setPathInput(dirPath)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    // Start at user's home directory
    window.api.sftp.home(sessionId).then((home: string) => {
      loadDir(home || '/')
    }).catch(() => {
      loadDir('/')
    })
  }, [loadDir])

  useEffect(() => {
    const unsub = window.api.sftp.onProgress(
      (sid: string, type: string, fileName: string, pct: number) => {
        if (sid !== sessionId) return
        if (pct >= 100) {
          setProgress(null)
          loadDir(currentPath)
        } else {
          setProgress({ type, fileName, pct })
        }
      }
    )
    return unsub
  }, [sessionId, currentPath, loadDir])

  function navigateTo(item: FileItem): void {
    if (item.isDir) {
      loadDir(item.path)
    }
  }

  function goUp(): void {
    if (currentPath === '/') return
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDir(parent)
  }

  function goToPath(): void {
    const p = pathInput.trim()
    if (p) loadDir(p)
  }

  async function handleDownload(file: FileItem): Promise<void> {
    const result = await window.api.sftp.download(sessionId, file.path, file.name)
    if (!result.success && result.error !== '已取消') {
      setError(`下载失败: ${result.error}`)
    }
  }

  async function handleUpload(): Promise<void> {
    const result = await window.api.sftp.upload(sessionId, currentPath)
    if (!result.success && result.error !== '已取消') {
      setError(`上传失败: ${result.error}`)
    }
  }

  async function handleDelete(file: FileItem): Promise<void> {
    const typeLabel = file.isDir ? '文件夹' : '文件'
    if (!confirm(`确认删除${typeLabel} "${file.name}" ?`)) return
    const result = await window.api.sftp.delete(sessionId, file.path, file.isDir)
    if (result.success) {
      loadDir(currentPath)
    } else {
      setError(`删除失败: ${result.error}`)
    }
  }

  async function handleMkdir(): Promise<void> {
    if (!newDirName.trim()) return
    const dirPath = currentPath === '/' ? `/${newDirName}` : `${currentPath}/${newDirName}`
    const result = await window.api.sftp.mkdir(sessionId, dirPath)
    if (result.success) {
      setShowMkdir(false)
      setNewDirName('')
      loadDir(currentPath)
    } else {
      setError(`创建文件夹失败: ${result.error}`)
    }
  }

  async function handleRename(): Promise<void> {
    if (!showRename || !renameValue.trim()) return
    const dir = showRename.path.split('/').slice(0, -1).join('/') || '/'
    const newPath = dir === '/' ? `/${renameValue}` : `${dir}/${renameValue}`
    const result = await window.api.sftp.rename(sessionId, showRename.path, newPath)
    if (result.success) {
      setShowRename(null)
      setRenameValue('')
      loadDir(currentPath)
    } else {
      setError(`重命名失败: ${result.error}`)
    }
  }

  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="fm-header">
          <h3>文件管理</h3>
          <button className="fm-close" onClick={onClose}>&times;</button>
        </div>

        <div className="fm-toolbar">
          <button onClick={goUp} disabled={currentPath === '/'} title="上级目录">⬆</button>
          <input
            className="fm-path-input"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goToPath()}
          />
          <button onClick={() => loadDir(currentPath)} title="刷新">↻</button>
          <button onClick={handleUpload} title="上传文件">上传</button>
          <button onClick={() => setShowMkdir(true)} title="新建文件夹">新建</button>
        </div>

        {error && <div className="fm-error">{error}<button onClick={() => setError('')}>&times;</button></div>}

        {progress && (
          <div className="fm-progress">
            <span>{progress.type === 'upload' ? '上传' : '下载'}: {progress.fileName}</span>
            <div className="fm-progress-bar">
              <div className="fm-progress-fill" style={{ width: `${progress.pct}%` }} />
            </div>
            <span>{progress.pct}%</span>
          </div>
        )}

        <div className="fm-file-list">
          {loading ? (
            <div className="fm-loading">加载中...</div>
          ) : files.length === 0 ? (
            <div className="fm-empty">空文件夹</div>
          ) : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>大小</th>
                  <th>修改时间</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.path}
                    className={`fm-row ${file.isDir ? 'fm-dir' : 'fm-file'}`}
                    onDoubleClick={() => navigateTo(file)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ x: e.clientX, y: e.clientY, file })
                    }}
                  >
                    <td className="fm-name">
                      <span className="fm-icon">{file.isDir ? '📁' : '📄'}</span>
                      {file.name}
                    </td>
                    <td className="fm-size">{file.isDir ? '-' : formatSize(file.size)}</td>
                    <td className="fm-time">{formatTime(file.modTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right-click context menu */}
        {contextMenu && (
          <div className="ctx-overlay" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}>
            <div className="ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
              {!contextMenu.file.isDir && (
                <div className="ctx-item" onClick={() => { handleDownload(contextMenu.file); setContextMenu(null) }}>下载</div>
              )}
              <div className="ctx-item" onClick={() => {
                setShowRename(contextMenu.file)
                setRenameValue(contextMenu.file.name)
                setContextMenu(null)
              }}>重命名</div>
              <div className="ctx-sep" />
              <div className="ctx-item ctx-danger" onClick={() => { handleDelete(contextMenu.file); setContextMenu(null) }}>删除</div>
            </div>
          </div>
        )}

        {/* New folder dialog */}
        {showMkdir && (
          <div className="fm-mini-dialog">
            <label>文件夹名称</label>
            <input
              autoFocus
              value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMkdir()}
            />
            <div className="fm-mini-actions">
              <button onClick={() => { setShowMkdir(false); setNewDirName('') }}>取消</button>
              <button onClick={handleMkdir}>创建</button>
            </div>
          </div>
        )}

        {/* Rename dialog */}
        {showRename && (
          <div className="fm-mini-dialog">
            <label>重命名为</label>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="fm-mini-actions">
              <button onClick={() => { setShowRename(null); setRenameValue('') }}>取消</button>
              <button onClick={handleRename}>确认</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
