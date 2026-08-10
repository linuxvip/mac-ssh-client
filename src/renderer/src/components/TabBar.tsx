import React, { useState, useRef } from 'react'
import { Tab } from '../types'

export type SplitDirection = 'vertical' | 'horizontal'
export type SplitDropZone = 'left' | 'right' | 'top' | 'bottom'

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
  onSplitDrag: (draggedId: string, targetId: string, zone: SplitDropZone) => void
}

export default function TabBar({
  tabs, activeTabId, onSelect, onClose, onNewTab, onReorder,
  onClone, onDisconnect, onReconnect, onSplitRequest, onSplitDrag
}: Props): JSX.Element {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: Tab } | null>(null)

  // Split drag state
  const [splitDropTabId, setSplitDropTabId] = useState<string | null>(null)
  const [splitDropZone, setSplitDropZone] = useState<SplitDropZone | null>(null)
  const splitDragTabRef = useRef<string | null>(null)

  function handleDragStart(e: React.DragEvent, index: number): void {
    dragRef.current = index
    setDragIndex(index)
    splitDragTabRef.current = tabs[index]?.id || null
    e.dataTransfer.setData('text/tab-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, index: number): void {
    if (dragRef.current === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndex(index)

    const targetTabId = tabs[index]?.id
    if (targetTabId && splitDragTabRef.current && targetTabId !== splitDragTabRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const xPct = (e.clientX - rect.left) / rect.width
      const yPct = (e.clientY - rect.top) / rect.height

      // Determine drop zone: if the horizontal distance from center is greater
      // than vertical, it's a vertical split. Otherwise horizontal.
      const dx = Math.abs(xPct - 0.5)
      const dy = Math.abs(yPct - 0.5)

      let zone: SplitDropZone
      if (dx > dy) {
        zone = xPct < 0.5 ? 'left' : 'right'
      } else {
        zone = yPct < 0.5 ? 'top' : 'bottom'
      }

      setSplitDropTabId(targetTabId)
      setSplitDropZone(zone)
    }
  }

  function handleDrop(e: React.DragEvent, toIndex: number): void {
    e.preventDefault()
    const fromIndex = dragRef.current

    if (splitDropTabId && splitDragTabRef.current && splitDropZone &&
        splitDropTabId !== splitDragTabRef.current) {
      onSplitDrag(splitDragTabRef.current, splitDropTabId, splitDropZone)
    } else if (fromIndex !== null && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex)
    }

    setDragIndex(null)
    setDropIndex(null)
    setSplitDropTabId(null)
    setSplitDropZone(null)
    dragRef.current = null
    splitDragTabRef.current = null
  }

  function handleDragEnd(): void {
    setDragIndex(null)
    setDropIndex(null)
    setSplitDropTabId(null)
    setSplitDropZone(null)
    dragRef.current = null
    splitDragTabRef.current = null
  }

  // Connected tabs other than the current one — used for split target picker
  const otherConnectedTabs = tabs.filter(
    (t) => t.status === 'connected' && t.id !== ctxMenu?.tab?.id
  )

  return (
    <div className="tab-bar">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''} status-${tab.status}${
            dragIndex === index ? ' dragging' : ''
          }${dropIndex === index && dragIndex !== index ? ' drop-target' : ''}${
            splitDropTabId === tab.id ? ` split-drop split-drop-${splitDropZone}` : ''
          }`}
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
          title="拖拽标签到另一个标签上可创建分屏（左/右=垂直，上/下=水平）"
        >
          <span className="tab-status-dot" />
          <span className="tab-title">{tab.title}</span>
          <button
            className="tab-close"
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
