import React, { useState } from 'react'
import { ConnectionConfig } from '../types'

interface SavedConnection extends ConnectionConfig {
  id: string
  createdAt: number
}

interface Props {
  onConnect: (config: ConnectionConfig, existingId?: string) => void
  onSave: (config: ConnectionConfig, existingId?: string) => void
  onClose: () => void
  editing?: SavedConnection | null
}

export default function ConnectionDialog({ onConnect, onSave, onClose, editing }: Props): JSX.Element {
  const [name, setName] = useState(editing?.name || '')
  const [host, setHost] = useState(editing?.host || '')
  const [port, setPort] = useState(String(editing?.port || 22))
  const [username, setUsername] = useState(editing?.username || '')
  const [password, setPassword] = useState(editing?.password || '')
  const [privateKey, setPrivateKey] = useState(editing?.privateKey || '')
  const [showPwd, setShowPwd] = useState(false)
  const [useJump, setUseJump] = useState(!!editing?.jumpHost)
  const [jumpHost, setJumpHost] = useState(editing?.jumpHost?.host || '')
  const [jumpPort, setJumpPort] = useState(String(editing?.jumpHost?.port || 22))
  const [jumpUser, setJumpUser] = useState(editing?.jumpHost?.username || '')
  const [jumpPass, setJumpPass] = useState(editing?.jumpHost?.password || '')
  const [showJumpPwd, setShowJumpPwd] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function buildConfig(): ConnectionConfig {
    return {
      name: name || host,
      host,
      port: parseInt(port, 10),
      username,
      password: password || undefined,
      privateKey: privateKey || undefined,
      jumpHost: useJump
        ? {
            host: jumpHost,
            port: parseInt(jumpPort, 10),
            username: jumpUser,
            password: jumpPass || undefined
          }
        : undefined
    }
  }

  function handleConnect(e: React.FormEvent): void {
    e.preventDefault()
    onConnect(buildConfig(), editing?.id)
  }

  function handleSave(): void {
    onSave(buildConfig(), editing?.id)
  }

  async function handleTestConnection(): Promise<void> {
    if (!host.trim() || !username.trim()) {
      setTestMsg({ ok: false, text: '请填写主机地址和用户名' })
      return
    }
    setTesting(true)
    setTestMsg(null)
    try {
      const config = buildConfig()
      const result = await (window as any).api.ssh.testConnection({
        ...config,
        sessionId: '__test__'
      } as any)
      if (result.success) {
        setTestMsg({ ok: true, text: '连接成功 ✓' })
      } else {
        setTestMsg({ ok: false, text: result.error || '连接失败' })
      }
    } catch (err: any) {
      setTestMsg({ ok: false, text: err.message || '测试出错' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? '编辑连接' : '新建 SSH 连接'}</h2>
        <form onSubmit={handleConnect}>
          <div className="form-section">
            <h3>主机信息</h3>
            <div className="form-row">
              <label>连接名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="我的服务器" />
            </div>
            <div className="form-row">
              <label>主机地址</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} required placeholder="192.168.1.1" />
            </div>
            <div className="form-row">
              <label>端口</label>
              <input value={port} onChange={(e) => setPort(e.target.value)} type="number" min={1} max={65535} />
            </div>
            <div className="form-row">
              <label>用户名</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="root" />
            </div>
            <div className="form-row">
              <label>密码</label>
              <div className="input-with-toggle">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPwd ? 'text' : 'password'} placeholder="(可选)" />
                <button type="button" className="btn-toggle-pwd" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? '隐藏' : '查看'}
                </button>
              </div>
            </div>
            <div className="form-row">
              <label>密钥路径</label>
              <input value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="~/.ssh/id_rsa (可选)" />
            </div>
          </div>

          <div className="form-section">
            <div className="form-row">
              <label>
                <input type="checkbox" checked={useJump} onChange={(e) => setUseJump(e.target.checked)} />
                {' '}使用跳板机
              </label>
            </div>
            {useJump && (
              <>
                <div className="form-row">
                  <label>跳板机地址</label>
                  <input value={jumpHost} onChange={(e) => setJumpHost(e.target.value)} required={useJump} placeholder="jump.example.com" />
                </div>
                <div className="form-row">
                  <label>跳板机端口</label>
                  <input value={jumpPort} onChange={(e) => setJumpPort(e.target.value)} type="number" min={1} max={65535} />
                </div>
                <div className="form-row">
                  <label>跳板机用户名</label>
                  <input value={jumpUser} onChange={(e) => setJumpUser(e.target.value)} required={useJump} />
                </div>
                <div className="form-row">
                  <label>跳板机密码</label>
                  <div className="input-with-toggle">
                    <input value={jumpPass} onChange={(e) => setJumpPass(e.target.value)} type={showJumpPwd ? 'text' : 'password'} placeholder="(可选)" />
                    <button type="button" className="btn-toggle-pwd" onClick={() => setShowJumpPwd(!showJumpPwd)}>
                      {showJumpPwd ? '隐藏' : '查看'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="dialog-actions">
            <button type="button" onClick={onClose}>取消</button>
            <button
              type="button"
              className={`btn-test ${testing ? 'btn-test-loading' : ''} ${testMsg?.ok ? 'btn-test-ok' : ''} ${testMsg && !testMsg.ok ? 'btn-test-fail' : ''}`}
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? '⏳ 测试中...' : testMsg?.ok ? '✓ 已连通' : testMsg && !testMsg.ok ? '✗ 重试' : '测试连接'}
            </button>
            <button type="button" className="btn-save" onClick={handleSave}>保存</button>
            <button type="submit">连接</button>
          </div>
          {testMsg && (
            <div className={`test-msg ${testMsg.ok ? 'test-msg-ok' : 'test-msg-fail'}`}>
              {testMsg.text}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
