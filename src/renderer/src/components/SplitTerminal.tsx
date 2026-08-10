import React, { useState, useRef } from 'react'
import Terminal from './Terminal'
import { Tab, SplitPair } from '../types'

interface Props {
  split: SplitPair
  tabA: Tab | undefined
  tabB: Tab | undefined
  activeTabId: string | null
  onStatusChange: (id: string, status: Tab['status']) => void
  onSplitChange: {
    createSplit: (tabA: string, tabB: string, direction: SplitPair['direction']) => void
    removeSplit: (splitId: string) => void
    updateSplitRatio: (splitId: string, ratio: number) => void
  }
  aiEnabled?: boolean
  copyOnSelect?: boolean
}

export default function SplitTerminal({ split, tabA, tabB, activeTabId, onStatusChange, onSplitChange, aiEnabled, copyOnSelect }: Props): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { direction, ratio } = split

  const isVertical = direction === 'vertical'
  const aStyle = isVertical
    ? { width: `${ratio * 100}%`, height: '100%' }
    : { width: '100%', height: `${ratio * 100}%` }
  const bStyle = isVertical
    ? { width: `${(1 - ratio) * 100}%`, height: '100%' }
    : { width: '100%', height: `${(1 - ratio) * 100}%` }

  function handleMouseDown(e: React.MouseEvent): void {
    e.preventDefault()
    setDragging(true)
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    function onMouseMove(ev: MouseEvent): void {
      const total = isVertical ? rect.width : rect.height
      const pos = isVertical ? ev.clientX - rect.left : ev.clientY - rect.top
      onSplitChange.updateSplitRatio(split.id, Math.max(0.15, Math.min(0.85, pos / total)))
    }

    function onMouseUp(): void {
      setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: isVertical ? 'row' : 'column',
    overflow: 'hidden'
  }

  return (
    <div
      className={`split-container${dragging ? ' split-dragging' : ''}`}
      ref={containerRef}
      style={containerStyle}
    >
      {/* Pane A */}
      <div
        className={`split-pane${activeTabId === split.tabA ? ' active-pane' : ''}`}
        style={{ ...aStyle, position: 'relative', overflow: 'hidden' }}
        onClick={() => tabA && onStatusChange(split.tabA, tabA.status)}
      >
        {tabA ? (
          <Terminal
            key={tabA.id}
            tab={tabA}
            active={true}
            onStatusChange={(status) => onStatusChange(tabA.id, status)}
            aiEnabled={aiEnabled}
            copyOnSelect={copyOnSelect}
          />
        ) : (
          <div className="empty-state"><p>标签页已关闭</p></div>
        )}
        <button className="split-close-btn" onClick={(e) => { e.stopPropagation(); onSplitChange.removeSplit(split.id) }} title="取消分屏">×</button>
      </div>

      {/* Handle */}
      <div className={`split-handle split-handle-${direction}`} onMouseDown={handleMouseDown} />

      {/* Pane B */}
      <div
        className={`split-pane${activeTabId === split.tabB ? ' active-pane' : ''}`}
        style={{ ...bStyle, position: 'relative', overflow: 'hidden' }}
        onClick={() => tabB && onStatusChange(split.tabB, tabB.status)}
      >
        {tabB ? (
          <Terminal
            key={tabB.id}
            tab={tabB}
            active={true}
            onStatusChange={(status) => onStatusChange(tabB.id, status)}
            aiEnabled={aiEnabled}
            copyOnSelect={copyOnSelect}
          />
        ) : (
          <div className="empty-state"><p>标签页已关闭</p></div>
        )}
        <button className="split-close-btn" onClick={(e) => { e.stopPropagation(); onSplitChange.removeSplit(split.id) }} title="取消分屏">×</button>
      </div>
    </div>
  )
}
