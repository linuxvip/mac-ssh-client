import React, { useState } from 'react'
import { ForwardRule } from '../types'

interface Props {
  sessionId: string
  onClose: () => void
}

export default function PortForwardPanel({ sessionId, onClose }: Props): JSX.Element {
  const [rules, setRules] = useState<ForwardRule[]>([])
  const [localPort, setLocalPort] = useState('')
  const [remoteHost, setRemoteHost] = useState('')
  const [remotePort, setRemotePort] = useState('')
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    const config = {
      localPort: parseInt(localPort, 10),
      remoteHost,
      remotePort: parseInt(remotePort, 10)
    }
    const result = await window.api.portForward.start(sessionId, config)
    if (result.success) {
      setRules((prev) => [
        ...prev,
        { id: result.forwardId!, ...config, active: true }
      ])
      setLocalPort('')
      setRemoteHost('')
      setRemotePort('')
    } else {
      setError(result.error || 'Failed to start forwarding')
    }
  }

  async function handleRemove(rule: ForwardRule): Promise<void> {
    await window.api.portForward.stop(rule.id)
    setRules((prev) => prev.filter((r) => r.id !== rule.id))
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Port Forwarding</h2>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <label>Local Port</label>
            <input
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
              type="number"
              min={1}
              max={65535}
              required
              placeholder="8080"
            />
          </div>
          <div className="form-row">
            <label>Remote Host</label>
            <input
              value={remoteHost}
              onChange={(e) => setRemoteHost(e.target.value)}
              required
              placeholder="localhost"
            />
          </div>
          <div className="form-row">
            <label>Remote Port</label>
            <input
              value={remotePort}
              onChange={(e) => setRemotePort(e.target.value)}
              type="number"
              min={1}
              max={65535}
              required
              placeholder="3306"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit">Add Rule</button>
        </form>

        <table className="forward-table">
          <thead>
            <tr>
              <th>Local Port</th>
              <th>Remote</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>127.0.0.1:{rule.localPort}</td>
                <td>{rule.remoteHost}:{rule.remotePort}</td>
                <td>{rule.active ? '🟢' : '🔴'}</td>
                <td>
                  <button onClick={() => handleRemove(rule)}>Remove</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#888' }}>No rules</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="dialog-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
