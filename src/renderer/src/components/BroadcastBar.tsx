import React, { useState, useRef, useEffect } from 'react'
import { Tab } from '../types'

interface Props {
  tabs: Tab[]
  onSend: (targetIds: string[], command: string) => void
}

export default function BroadcastBar({ tabs, onSend }: Props): JSX.Element {
  const [mode, setMode] = useState<'all' | 'select'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const connected = tabs.filter((t) => t.status === 'connected')
  const targets = mode === 'all' ? connected : connected.filter((t) => selected.has(t.id))

  // Drop selection of tabs that are no longer connected
  useEffect(() => {
    const ids = new Set(connected.map((t) => t.id))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [tabs])

  useEffect(() => {
    if (pickerOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [pickerOpen])

  function switchMode(next: 'all' | 'select'): void {
    setMode(next)
    if (next === 'select' && selected.size === 0 && connected.length > 0) {
      setSelected(new Set(connected.map((t) => t.id)))
    }
  }

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll(): void {
    setSelected(new Set(connected.map((t) => t.id)))
  }

  function clearAll(): void {
    setSelected(new Set())
  }

  function send(): void {
    const text = input.trim()
    if (!text || targets.length === 0) return
    onSend(targets.map((t) => t.id), text)
    setHistory((prev) => [text, ...prev.filter((h) => h !== text)].slice(0, 50))
    setHistoryIdx(-1)
    setInput('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      send()
    } else if (e.key === 'ArrowUp') {
      if (history.length === 0) return
      e.preventDefault()
      const idx = historyIdx === -1 ? 0 : Math.min(historyIdx + 1, history.length - 1)
      setHistoryIdx(idx)
      setInput(history[idx])
    } else if (e.key === 'ArrowDown') {
      if (historyIdx === -1) return
      e.preventDefault()
      const idx = historyIdx - 1
      setHistoryIdx(idx)
      setInput(idx === -1 ? '' : history[idx])
    } else if (e.key === 'Escape') {
      setPickerOpen(false)
    }
  }

  return (
    <div className="broadcast-bar">
      <div className="broadcast-targets">
        <div className="broadcast-mode-toggle">
          <button
            className={mode === 'all' ? 'active' : ''}
            onClick={() => switchMode('all')}
            title="发送到所有已连接的标签"
          >
            全部
          </button>
          <button
            className={mode === 'select' ? 'active' : ''}
            onClick={() => switchMode('select')}
            title="手动勾选要发送的标签"
          >
            选择
          </button>
        </div>
        <button
          className="broadcast-target-info"
          onClick={() => setPickerOpen((v) => !v)}
          title="目标会话"
        >
          {targets.length}/{connected.length} 个会话
          <span className="broadcast-arrow">{pickerOpen ? '▲' : '▼'}</span>
        </button>
        {pickerOpen && (
          <div className="broadcast-picker">
            <div className="broadcast-picker-header">
              <span>目标会话</span>
              <div className="broadcast-picker-actions">
                <button onClick={selectAll}>全选</button>
                <button onClick={clearAll}>清空</button>
              </div>
            </div>
            <ul className="broadcast-picker-list">
              {connected.map((t) => (
                <li
                  key={t.id}
                  className={`broadcast-picker-item${selected.has(t.id) ? ' checked' : ''}`}
                  onClick={() => toggleSelect(t.id)}
                >
                  <input type="checkbox" readOnly checked={selected.has(t.id)} />
                  <span className="broadcast-picker-name">{t.title}</span>
                  <span className="broadcast-picker-host">{t.config.host}</span>
                </li>
              ))}
              {connected.length === 0 && (
                <li className="broadcast-picker-empty">暂无已连接的会话</li>
              )}
            </ul>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        className="broadcast-input"
        type="text"
        placeholder={targets.length > 0 ? '输入命令，Enter 发送到所选会话（↑↓ 历史）' : '暂无已连接的会话'}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={targets.length === 0}
      />
      <button
        className="broadcast-send"
        onClick={send}
        disabled={targets.length === 0 || !input.trim()}
      >
        发送
      </button>
    </div>
  )
}
