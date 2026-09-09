import React, { useState, useRef, useEffect } from 'react'
import { Tab } from '../types'

export type SplitDirection = 'vertical' | 'horizontal'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewTab: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onClone: (id: string) => void
  onDisconnect: (id: string) => void
  onReconnect: (id: string) => void
  onSplitRequest: (sourceTabId: string, direction: SplitDirection) => void
  onTabDragStart: (id: string) => void
  onTabDragEnd: () => void
}

export default function TabBar({
  tabs, activeTabId, onSelect, onClose, onNewTab, onReorder,
  onClone, onDisconnect, onReconnect, onSplitRequest, onTabDragStart, onTabDragEnd
}: Props): JSX.Element {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: Tab } | null>(null)

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.tab.active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeTabId])

  function handleDragStart(e: React.DragEvent, index: number): void {
    dragRef.current = index
    setDragIndex(index)
    const tabId = tabs[index]?.id || ''
    e.dataTransfer.setData('text/plain', tabId)
    e.dataTransfer.setData('text/tab-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
    onTabDragStart(tabId)
  }

  function handleDragOver(e: React.DragEvent, index: number): void {
    if (dragRef.current === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }

  function handleDrop(e: React.DragEvent, toIndex: number): void {
    e.preventDefault()
    const fromIndex = dragRef.current
    if (fromIndex !== null && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex)
    }

    setDragIndex(null)
    setDropIndex(null)
    dragRef.current = null
    onTabDragEnd()
  }

  function handleDragEnd(): void {
    setDragIndex(null)
    setDropIndex(null)
    dragRef.current = null
    onTabDragEnd()
  }

  // Connected tabs other than the current one — used for split target picker
  const otherConnectedTabs = tabs.filter(
    (t) => t.status === 'connected' && t.id !== ctxMenu?.tab?.id
  )

  return (
    <div className="tab-bar" ref={listRef}>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''} status-${tab.status}${
            dragIndex === index ? ' dragging' : ''
          }${dropIndex === index && dragIndex !== index ? ' drop-target' : ''}`}
          onMouseDown={(e) => {
            // Switch on press so a tiny mouse movement (which turns the click
            // into an HTML5 drag) can no longer swallow the selection.
            if (e.button === 0) onSelect(tab.id)
          }}
          onClick={() => onSelect(tab.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setCtxMenu({ x: e.clientX, y: e.clientY, tab })
          }}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          title="拖动标签到终端区域可实现左右/上下分屏"
        >
          <span className="tab-status-dot" />
          <span className="tab-title">{tab.title}</span>
          <button
            className="tab-close"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
          >×</button>
        </div>
      ))}
      <button className="new-tab-btn" onClick={onNewTab} title="New connection">+</button>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div className="ctx-overlay" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }}>
          <div className="ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
            <div className="ctx-item" onClick={() => { onClone(ctxMenu.tab.id); setCtxMenu(null) }}>克隆会话</div>
            {ctxMenu.tab.status === 'connected' && (
              <>
                <div className="ctx-sep" />
                <div className="ctx-item ctx-has-sub" onClick={(e) => e.stopPropagation()}>
                  <span>左右分屏 ▸</span>
                  <div className="ctx-submenu">
                    {otherConnectedTabs.length === 0 ? (
                      <div className="ctx-item ctx-disabled">无其他已连接标签</div>
                    ) : (
                      otherConnectedTabs.map((t) => (
                        <div key={t.id} className="ctx-item"
                          onClick={() => { onSplitRequest(ctxMenu.tab.id, 'vertical'); setCtxMenu(null) }}>
                          {t.title}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="ctx-item ctx-has-sub" onClick={(e) => e.stopPropagation()}>
                  <span>上下分屏 ▸</span>
                  <div className="ctx-submenu">
                    {otherConnectedTabs.length === 0 ? (
                      <div className="ctx-item ctx-disabled">无其他已连接标签</div>
                    ) : (
                      otherConnectedTabs.map((t) => (
                        <div key={t.id} className="ctx-item"
                          onClick={() => { onSplitRequest(ctxMenu.tab.id, 'horizontal'); setCtxMenu(null) }}>
                          {t.title}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="ctx-sep" />
            {ctxMenu.tab.status === 'connected' ? (
              <div className="ctx-item" onClick={() => { onDisconnect(ctxMenu.tab.id); setCtxMenu(null) }}>断开连接</div>
            ) : (
              <div className="ctx-item" onClick={() => { onReconnect(ctxMenu.tab.id); setCtxMenu(null) }}>重新连接</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
