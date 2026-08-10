import React, { useState, useRef, useEffect } from 'react'

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  cmd?: string
  explain?: string
  type?: 'command' | 'ai' | 'error'
}

interface Props {
  visible: boolean
  sessionId: string | null
  onClose: () => void
  onExecute: (cmd: string) => void
}

export default function AIPanel({ visible, sessionId, onClose, onExecute }: Props): JSX.Element | null {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [visible])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text || !sessionId || loading) return

    const userMsg: AIMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const result = await (window as any).api.ai.process(sessionId, text)
      const aiMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.explain || result.cmd || result.error || '',
        cmd: result.cmd,
        explain: result.explain,
        type: result.type
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      const errMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err.message || '请求失败',
        type: 'error'
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!visible) return null

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span className="ai-panel-title">AI 助手</span>
        <button className="ai-panel-close" onClick={onClose}>&times;</button>
      </div>
      <div className="ai-panel-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="ai-panel-empty">
            输入自然语言描述，AI 将生成对应的命令
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-msg ai-msg-${msg.role}`}>
            {msg.role === 'user' ? (
              <div className="ai-msg-content">{msg.content}</div>
            ) : msg.type === 'error' ? (
              <div className="ai-msg-content ai-msg-error">{msg.content}</div>
            ) : (
              <div className="ai-msg-content">
                {msg.explain && <div className="ai-msg-explain">{msg.explain}</div>}
                {msg.cmd && (
                  <>
                    <div className="ai-cmd-block">
                      <code>{msg.cmd}</code>
                    </div>
                    <div className="ai-cmd-actions">
                      <button
                        className="ai-btn-execute"
                        onClick={() => onExecute(msg.cmd!)}
                      >
                        执行
                      </button>
                      <button
                        className="ai-btn-copy"
                        onClick={() => navigator.clipboard.writeText(msg.cmd!)}
                      >
                        复制
                      </button>
                      <button
                        className="ai-btn-cancel"
                        onClick={() => {
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id))
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-msg-content ai-msg-loading">
              <span className="ai-typing-dot" />
              <span className="ai-typing-dot" />
              <span className="ai-typing-dot" />
            </div>
          </div>
        )}
      </div>
      <div className="ai-panel-input">
        <input
          ref={inputRef}
          type="text"
          placeholder={sessionId ? '描述你想执行的操作...' : '请先连接 SSH 会话'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!sessionId || loading}
        />
        <button onClick={handleSend} disabled={!sessionId || loading || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  )
}
