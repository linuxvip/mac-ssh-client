import React, { useState } from 'react'
import { ConnectionConfig, ForwardRule } from '../types'

interface SavedConnection extends ConnectionConfig {
  id: string
  createdAt: number
}

interface Tunnel {
  id: string
  connectionName: string
  localPort: number
  remoteHost: string
  remotePort: number
  status: 'connecting' | 'active' | 'error'
  error?: string
}

interface Props {
  savedConnections: SavedConnection[]
}

export default function PortForwardView({ savedConnections }: Props): JSX.Element {
  const [tunnels, setTunnels] = useState<Tunnel[]>([])
  const [showForm, setShowForm] = useState(false)

  const [selectedConn, setSelectedConn] = useState('')
  const [localPort, setLocalPort] = useState('')
  const [remoteHost, setRemoteHost] = useState('localhost')
  const [remotePort, setRemotePort] = useState('')
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')

    const conn = savedConnections.find((c) => c.id === selectedConn)
    if (!conn) {
      setError('请选择一个连接')
      return
    }

    const tunnelId = crypto.randomUUID()
    const tunnel: Tunnel = {
      id: tunnelId,
      connectionName: conn.name || `${conn.username}@${conn.host}`,
      localPort: parseInt(localPort, 10),
      remoteHost,
      remotePort: parseInt(remotePort, 10),
      status: 'connecting'
    }
    setTunnels((prev) => [...prev, tunnel])
    setShowForm(false)

    const sshResult = await window.api.ssh.connect({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.password,
      privateKey: conn.privateKey,
      jumpHost: conn.jumpHost,
      sessionId: tunnelId
    })

    if (!sshResult.success) {
      setTunnels((prev) =>
        prev.map((t) => t.id === tunnelId ? { ...t, status: 'error', error: sshResult.error } : t)
      )
      return
    }

    const fwResult = await window.api.portForward.start(tunnelId, {
      localPort: parseInt(localPort, 10),
      remoteHost,
      remotePort: parseInt(remotePort, 10)
    })

    if (fwResult.success) {
      setTunnels((prev) =>
        prev.map((t) => t.id === tunnelId ? { ...t, status: 'active' } : t)
      )
    } else {
      setTunnels((prev) =>
        prev.map((t) => t.id === tunnelId ? { ...t, status: 'error', error: fwResult.error } : t)
      )
    }

    setLocalPort('')
    setRemoteHost('localhost')
    setRemotePort('')
    setSelectedConn('')
  }

  async function removeTunnel(tunnel: Tunnel): Promise<void> {
    const forwardId = `${tunnel.id}:${tunnel.localPort}`
    await window.api.portForward.stop(forwardId)
    await window.api.ssh.disconnect(tunnel.id)
    setTunnels((prev) => prev.filter((t) => t.id !== tunnel.id))
  }

  return (
    <div className="pf-view">
      <div className="sidebar-header">
        <span>隧道列表</span>
        <button className="btn-new" onClick={() => setShowForm(!showForm)}>+</button>
      </div>

      {showForm && (
        <form className="pf-form" onSubmit={handleAdd}>
          <div className="pf-field">
            <label>选择连接</label>
            <select value={selectedConn} onChange={(e) => setSelectedConn(e.target.value)} required>
              <option value="">-- 请选择 --</option>
              {savedConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || `${c.username}@${c.host}`}
                </option>
              ))}
            </select>
          </div>
          <div className="pf-field">
            <label>本地端口</label>
            <input value={localPort} onChange={(e) => setLocalPort(e.target.value)} type="number" min={1} max={65535} required placeholder="8080" />
          </div>
          <div className="pf-field">
            <label>远程主机</label>
            <input value={remoteHost} onChange={(e) => setRemoteHost(e.target.value)} required placeholder="localhost" />
          </div>
          <div className="pf-field">
            <label>远程端口</label>
            <input value={remotePort} onChange={(e) => setRemotePort(e.target.value)} type="number" min={1} max={65535} required placeholder="3306" />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="pf-btn-add">启动隧道</button>
        </form>
      )}

      <ul className="tunnel-list">
        {tunnels.map((t) => (
          <li key={t.id} className={`tunnel-item status-${t.status}`}>
            <div className="tunnel-info">
              <span className="tunnel-status-dot" />
              <div className="tunnel-detail">
                <span className="tunnel-label">:{t.localPort} → {t.remoteHost}:{t.remotePort}</span>
                <span className="tunnel-via">{t.connectionName}</span>
                {t.error && <span className="tunnel-error">{t.error}</span>}
              </div>
            </div>
            <button className="btn-delete" onClick={() => removeTunnel(t)}>×</button>
          </li>
        ))}
        {tunnels.length === 0 && !showForm && (
          <li className="tunnel-empty">暂无活动隧道</li>
        )}
      </ul>
    </div>
  )
}
