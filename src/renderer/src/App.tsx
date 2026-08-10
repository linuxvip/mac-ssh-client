import React, { useState, useEffect, useRef } from 'react'
import TabBar from './components/TabBar'
import Terminal from './components/Terminal'
import SplitDropOverlay from './components/SplitDropOverlay'
import SplitHandle from './components/SplitHandle'
import ConnectionDialog from './components/ConnectionDialog'
import PortForwardView from './components/PortForwardView'
import FileManager from './components/FileManager'
import MonitorOverlay from './components/MonitorOverlay'
import AIPanel from './components/AIPanel'
import SettingsDialog from './components/SettingsDialog'
import { Tab, ConnectionConfig, SplitPair } from './types'
import { themes, ThemeColors, applyTheme } from './themes'

export interface SavedConnection extends ConnectionConfig {
  id: string
  createdAt: number
  groupId?: string
}

export interface ConnectionGroup {
  id: string
  name: string
  collapsed: boolean
}

type SidebarTab = 'connections' | 'portforward' | 'monitor'

function genId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function App(): JSX.Element {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([])
  const [groups, setGroups] = useState<ConnectionGroup[]>([])
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('connections')
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number;
    connection?: SavedConnection;
    group?: ConnectionGroup;
  } | null>(null)
  const [fileManagerTabId, setFileManagerTabId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiOn, setAiOn] = useState(true)
  const [copyOnSelect, setCopyOnSelect] = useState(true)
  const [currentTheme, setCurrentTheme] = useState('深色 (默认)')
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  const [dragOverConnId, setDragOverConnId] = useState<string | null>(null)
  const [dragOverConnPos, setDragOverConnPos] = useState<'above' | 'below'>('below')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [splits, setSplits] = useState<SplitPair[]>([])
  // Split picker: after choosing a direction, user picks which other tab to split with
  const [splitPicker, setSplitPicker] = useState<{
    sourceTabId: string
    direction: SplitPair['direction']
  } | null>(null)
  // Drag-tab-to-split state
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [splitDropZone, setSplitDropZone] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null)
  const groupInputRef = useRef<HTMLInputElement>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  const [sidebarWidth, setSidebarWidth] = useState(220)
  const isResizing = useRef(false)

  function handleResizerMouseDown(e: React.MouseEvent): void {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(ev: MouseEvent): void {
      if (!isResizing.current) return
      const w = Math.min(400, Math.max(160, ev.clientX))
      setSidebarWidth(w)
    }

    function onMouseUp(): void {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Persist helper
  function persistConnections(conns: SavedConnection[], grps: ConnectionGroup[]): void {
    window.api.connections.save({ connections: conns, groups: grps })
  }

  useEffect(() => {
    window.api.connections.load().then((data: any) => {
      if (Array.isArray(data)) {
        // Old format
        setSavedConnections(data || [])
        setGroups([])
      } else {
        setSavedConnections(data?.connections || [])
        setGroups(data?.groups || [])
      }
    })
    window.api.settings.load().then((settings: any) => {
      if (settings?.theme) {
        const t = themes.find((th) => th.name === settings.theme)
        if (t) {
          applyTheme(t.colors)
          setCurrentTheme(t.name)
        }
      }
      if (settings?.ai?.apiUrl && settings?.ai?.model) {
        setAiEnabled(true)
      }
      if (settings?.ai?.disabled === true) {
        setAiOn(false)
      }
      if (settings?.copyOnSelect !== undefined) {
        setCopyOnSelect(!!settings.copyOnSelect)
      }
    })
  }, [])

  useEffect(() => {
    if (editingGroupId && groupInputRef.current) {
      groupInputRef.current.focus()
      groupInputRef.current.select()
    }
  }, [editingGroupId])

  function saveConnection(config: ConnectionConfig, existingId?: string): void {
    if (existingId) {
      setSavedConnections((prev) => {
        const updated = prev.map((c) =>
          c.id === existingId ? { ...config, id: existingId, createdAt: c.createdAt, groupId: c.groupId } : c
        )
        persistConnections(updated, groups)
        return updated
      })
    } else {
      const saved: SavedConnection = { ...config, id: genId(), createdAt: Date.now(), groupId: selectedGroupId || undefined }
      setSavedConnections((prev) => {
        const updated = [...prev, saved]
        persistConnections(updated, groups)
        return updated
      })
    }
  }

  function handleConnect(config: ConnectionConfig, existingId?: string): void {
    const id = genId()
    setTabs((prev) => [...prev, { id, config, status: 'connecting', title: config.name || `${config.username}@${config.host}` }])
    setActiveTabId(id)
    setShowConnect(false)
    setEditingConnection(null)
    saveConnection(config, existingId)
  }

  function handleSaveOnly(config: ConnectionConfig, existingId?: string): void {
    saveConnection(config, existingId)
    setShowConnect(false)
    setEditingConnection(null)
  }

function closeTab(id: string): void {
    window.api.ssh.disconnect(id)
    removeSplitsForTab(id)
    setTabs((prev) => prev.filter((t) => t.id !== id))
    if (activeTabId === id) {
      const remaining = tabs.filter((t) => t.id !== id)
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
    }
  }

  function disconnectTab(id: string): void {
    window.api.ssh.disconnect(id)
    updateTabStatus(id, 'disconnected')
  }

  function reconnectTab(id: string): void {
    const tab = tabs.find((t) => t.id === id)
    if (!tab) return
    window.api.ssh.disconnect(id)
    removeSplitsForTab(id)
    const newId = genId()
    setTabs((prev) => [
      ...prev.filter((t) => t.id !== id),
      { id: newId, config: tab.config, status: 'connecting', title: tab.config.name || `${tab.config.username}@${tab.config.host}` }
    ])
    setActiveTabId(newId)
  }

  function cloneTab(id: string): void {
    const tab = tabs.find((t) => t.id === id)
    if (!tab) return
    removeSplitsForTab(id)
    const newId = genId()
    setTabs((prev) => [...prev, { ...tab, id: newId, status: 'connecting' as const }])
    setActiveTabId(newId)
  }

  // ─── Split management ──────────────────────────────────────────────

  function createSplit(tabA: string, tabB: string, direction: SplitPair['direction']): void {
    // Remove any existing splits involving these tabs
    setSplits((prev) => prev.filter((s) => s.tabA !== tabA && s.tabB !== tabA && s.tabA !== tabB && s.tabB !== tabB))
    // Create new split
    const split: SplitPair = {
      id: genId(),
      direction,
      ratio: 0.5,
      tabA,
      tabB
    }
    setSplits((prev) => [...prev, split])
    setActiveTabId(tabA)
  }

  function removeSplit(splitId: string): void {
    setSplits((prev) => prev.filter((s) => s.id !== splitId))
  }

  // Remove any splits that reference the given tab id
  function removeSplitsForTab(tabId: string): void {
    setSplits((prev) => prev.filter((s) => s.tabA !== tabId && s.tabB !== tabId))
  }

  function updateSplitRatio(splitId: string, ratio: number): void {
    setSplits((prev) => prev.map((s) => (s.id === splitId ? { ...s, ratio } : s)))
  }

  // ─── Drag tab to terminal area → split ─────────────────────────────

  function handleTabDragStart(id: string): void {
    setDraggingTabId(id)
  }

  function handleTabDragEnd(): void {
    setDraggingTabId(null)
    setSplitDropZone(null)
  }

  function handleTerminalDragOver(e: React.DragEvent): void {
    if (!draggingTabId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    let zone: 'left' | 'right' | 'top' | 'bottom'
    if (x < 0.3) zone = 'left'
    else if (x > 0.7) zone = 'right'
    else zone = y < 0.5 ? 'top' : 'bottom'
    setSplitDropZone(zone)
  }

  function handleTerminalDragLeave(e: React.DragEvent): void {
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !e.currentTarget.contains(related)) {
      setSplitDropZone(null)
    }
  }

  function handleTerminalDrop(e: React.DragEvent): void {
    e.preventDefault()
    const zone = splitDropZone
    const sourceId = draggingTabId
    setSplitDropZone(null)
    setDraggingTabId(null)
    if (!zone || !sourceId) return

    const source = tabs.find((t) => t.id === sourceId)
    if (!source) return

    const direction: SplitPair['direction'] =
      zone === 'left' || zone === 'right' ? 'vertical' : 'horizontal'

    // Partner tab = current active tab (must be another connected tab)
    const partnerOk =
      activeTabId && activeTabId !== sourceId && activeTab?.status === 'connected'

    if (!partnerOk) {
      // Reuse split picker to choose a partner tab
      setSplitPicker({ sourceTabId: sourceId, direction })
      return
    }

    const [tabA, tabB] =
      zone === 'left' || zone === 'top' ? [sourceId, activeTabId!] : [activeTabId!, sourceId]
    createSplit(tabA, tabB, direction)
  }

  function updateTabStatus(id: string, status: Tab['status']): void {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  function deleteSavedConnection(id: string): void {
    setSavedConnections((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      persistConnections(updated, groups)
      return updated
    })
  }

  function connectSaved(saved: SavedConnection): void {
    const { id: _id, createdAt: _ts, groupId: _gid, ...config } = saved
    handleConnect(config, saved.id)
  }

  function editSavedConnection(saved: SavedConnection): void {
    setEditingConnection(saved)
  }

  function closeDialog(): void {
    setShowConnect(false)
    setEditingConnection(null)
  }

  function handleThemeApply(themeName: string, _colors: ThemeColors): void {
    setCurrentTheme(themeName)
    // Reload settings to pick up AI config changes
    window.api.settings.load().then((settings: any) => {
      if (settings?.ai?.apiUrl && settings?.ai?.model) {
        setAiEnabled(true)
      } else {
        setAiEnabled(false)
      }
    })
  }

  function handleAIExecute(cmd: string): void {
    if (activeTabId) {
      window.api.ssh.send(activeTabId, cmd + '\n')
    }
  }

  function toggleAI(): void {
    const next = !aiOn
    setAiOn(next)
    if (!next) setShowAIPanel(false)
    window.api.settings.load().then((settings: any) => {
      window.api.settings.save({ ...settings, ai: { ...(settings?.ai || {}), disabled: !next } })
    })
  }

  // --- Tab reorder ---
  function handleTabReorder(fromIndex: number, toIndex: number): void {
    setTabs((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  // --- Group CRUD ---
  function createGroup(): void {
    const newGroup: ConnectionGroup = { id: genId(), name: '新分组', collapsed: false }
    const updated = [...groups, newGroup]
    setGroups(updated)
    persistConnections(savedConnections, updated)
    setEditingGroupId(newGroup.id)
    setEditingGroupName(newGroup.name)
  }

  function toggleGroupCollapse(groupId: string): void {
    setGroups((prev) => {
      const updated = prev.map((g) => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g)
      persistConnections(savedConnections, updated)
      return updated
    })
  }

  function renameGroup(groupId: string, newName: string): void {
    const name = newName.trim()
    if (!name) return
    setGroups((prev) => {
      const updated = prev.map((g) => g.id === groupId ? { ...g, name } : g)
      persistConnections(savedConnections, updated)
      return updated
    })
    setEditingGroupId(null)
  }

  function deleteGroup(groupId: string): void {
    setSavedConnections((prev) => {
      const updated = prev.map((c) => c.groupId === groupId ? { ...c, groupId: undefined } : c)
      const newGroups = groups.filter((g) => g.id !== groupId)
      setGroups(newGroups)
      persistConnections(updated, newGroups)
      return updated
    })
  }

  // --- Sidebar DnD ---
  function handleConnectionDragStart(e: React.DragEvent, connId: string): void {
    e.dataTransfer.setData('text/connection-id', connId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleGroupDragOver(e: React.DragEvent): void {
    if (e.dataTransfer.types.includes('text/connection-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }

  function handleGroupDrop(e: React.DragEvent, groupId: string | undefined): void {
    e.preventDefault()
    const connId = e.dataTransfer.getData('text/connection-id')
    if (!connId) return
    setDragOverGroupId(null)
    setSavedConnections((prev) => {
      const updated = prev.map((c) =>
        c.id === connId ? { ...c, groupId: groupId || undefined } : c
      )
      persistConnections(updated, groups)
      return updated
    })
  }

  function handleGroupDragEnter(e: React.DragEvent, groupId: string | null): void {
    if (e.dataTransfer.types.includes('text/connection-id')) {
      e.preventDefault()
      setDragOverGroupId(groupId)
    }
  }

  function handleGroupDragLeave(e: React.DragEvent): void {
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !e.currentTarget.contains(related)) {
      setDragOverGroupId(null)
    }
  }

  // Render a single connection item
  function renderConnectionItem(c: SavedConnection): JSX.Element {
    const isOver = dragOverConnId === c.id
    return (
      <li
        key={c.id}
        className={`connection-item${isOver ? ` drag-insert-${dragOverConnPos}` : ''}`}
        draggable
        onDragStart={(e) => handleConnectionDragStart(e, c.id)}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('text/connection-id')) return
          e.preventDefault()
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setDragOverConnId(c.id)
          setDragOverConnPos(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below')
        }}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            setDragOverConnId(null)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const draggedId = e.dataTransfer.getData('text/connection-id')
          setDragOverConnId(null)
          if (!draggedId || draggedId === c.id) return
          setSavedConnections((prev) => {
            const updated = [...prev]
            const fromIdx = updated.findIndex((x) => x.id === draggedId)
            if (fromIdx === -1) return prev
            const [item] = updated.splice(fromIdx, 1)
            const toIdx = updated.findIndex((x) => x.id === c.id)
            if (toIdx === -1) return prev
            const insertIdx = dragOverConnPos === 'above' ? toIdx : toIdx + 1
            updated.splice(insertIdx, 0, { ...item, groupId: c.groupId })
            persistConnections(updated, groups)
            return updated
          })
        }}
        onDoubleClick={() => connectSaved(c)}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY, connection: c })
        }}
        title={`${c.username}@${c.host}:${c.port}\n双击连接 | 右键菜单`}
      >
        <span className="connection-name">
          {c.name || `${c.username}@${c.host}`}
        </span>
      </li>
    )
  }

  const ungroupedConnections = savedConnections.filter((c) => !c.groupId)

  return (
    <div className="app">
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${sidebarTab === 'connections' ? 'active' : ''}`}
            onClick={() => setSidebarTab('connections')}
          >
            连接管理
          </button>
          <button
            className={`sidebar-tab ${sidebarTab === 'portforward' ? 'active' : ''}`}
            onClick={() => setSidebarTab('portforward')}
          >
            端口转发
          </button>
          <button
            className={`sidebar-tab ${sidebarTab === 'monitor' ? 'active' : ''}`}
            onClick={() => setSidebarTab('monitor')}
          >
            监控
          </button>
        </div>

        {sidebarTab === 'connections' && (
          <>
            <div className="sidebar-header">
              <span>已保存</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button className="btn-new" onClick={createGroup} title="新建分组">&#128193;</button>
                <button className="btn-new" onClick={() => setShowConnect(true)} title="新建连接">+</button>
              </div>
            </div>
            <div className="sidebar-search">
              <input
                type="text"
                className="search-input"
                placeholder="搜索主机名或 IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onClick={() => setSearchQuery('')}
                  title="清除搜索"
                >
                  ×
                </button>
              )}
            </div>
            <ul className="connection-list">
              {searchQuery ? (
                /* Search mode — flat list filtered by name or host */
                savedConnections
                  .filter((c) => {
                    const q = searchQuery.toLowerCase()
                    return (
                      (c.name || '').toLowerCase().includes(q) ||
                      c.host.toLowerCase().includes(q) ||
                      `${c.username}@${c.host}`.toLowerCase().includes(q)
                    )
                  })
                  .map((c) => {
                    const group = groups.find((g) => g.id === c.groupId)
                    return renderConnectionItem({
                      ...c,
                      name: group ? `${group.name} - ${c.name || `${c.username}@${c.host}`}` : (c.name || `${c.username}@${c.host}`)
                    })
                  })
              ) : (
                /* Normal mode — grouped view */
                <>
              {groups.map((group) => {
                const groupConns = savedConnections.filter((c) => c.groupId === group.id)
                return (
                  <li key={group.id} className="connection-group">
                    <div
                      className={`group-header ${dragOverGroupId === group.id ? 'drag-over' : ''} ${selectedGroupId === group.id ? 'selected' : ''}`}
                      onClick={() => {
                        if (editingGroupId !== group.id) {
                          setSelectedGroupId(group.id)
                          toggleGroupCollapse(group.id)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, group })
                      }}
                      onDragOver={handleGroupDragOver}
                      onDragEnter={(e) => handleGroupDragEnter(e, group.id)}
                      onDragLeave={handleGroupDragLeave}
                      onDrop={(e) => handleGroupDrop(e, group.id)}
                    >
                      <span className="group-arrow">{group.collapsed ? '▶' : '▼'}</span>
                      {editingGroupId === group.id ? (
                        <input
                          ref={groupInputRef}
                          className="group-name-input"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onBlur={() => renameGroup(group.id, editingGroupName)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameGroup(group.id, editingGroupName)
                            if (e.key === 'Escape') setEditingGroupId(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="group-name">{group.name}</span>
                      )}
                      <span className="group-count">{groupConns.length}</span>
                    </div>
                    {!group.collapsed && (
                      <ul className="group-connections">
                        {groupConns.map(renderConnectionItem)}
                      </ul>
                    )}
                  </li>
                )
              })}
              {/* Ungrouped connections — flat list, drop zone to remove from group */}
              {ungroupedConnections.length > 0 && (
                <li
                  className={`ungrouped-zone ${dragOverGroupId === '__ungrouped' ? 'drag-over' : ''}`}
                  onDragOver={handleGroupDragOver}
                  onDragEnter={(e) => handleGroupDragEnter(e, '__ungrouped')}
                  onDragLeave={handleGroupDragLeave}
                  onDrop={(e) => handleGroupDrop(e, undefined)}
                  onClick={() => setSelectedGroupId(null)}
                >
                  <ul className="ungrouped-list">
                    {ungroupedConnections.map(renderConnectionItem)}
                  </ul>
                </li>
              )}
              {/* No groups and no ungrouped rendered above: show flat */}
              {groups.length === 0 && ungroupedConnections.length === 0 && savedConnections.map(renderConnectionItem)}
              </>
            )}
            </ul>
          </>
        )}

        {sidebarTab === 'portforward' && (
          <PortForwardView savedConnections={savedConnections} />
        )}

        {sidebarTab === 'monitor' && (
          <div className="sidebar-monitor">
            <div className="sidebar-header">
              <span>系统监控</span>
            </div>
            {activeTab && activeTab.status === 'connected' ? (
              <MonitorOverlay key={`monitor-${activeTab.id}`} sessionId={activeTab.id} host={activeTab.config.host} />
            ) : (
              <div className="monitor-empty">
                <p>暂无活动连接</p>
                <p className="monitor-empty-hint">连接 SSH 后在此查看系统监控</p>
              </div>
            )}
          </div>
        )}

        <div className="sidebar-footer">
          <button className="btn-settings" onClick={() => setShowSettings(true)}>
            设置
          </button>
          {aiEnabled && (
            <button className={`btn-ai-toggle ${aiOn ? 'ai-on' : 'ai-off'}`} onClick={toggleAI}>
              {aiOn ? 'AI 已启用' : 'AI 已关闭'}
            </button>
          )}
        </div>
      </div>
      <div className="sidebar-resizer" onMouseDown={handleResizerMouseDown} />
      <div className="main">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={setActiveTabId}
          onClose={closeTab}
          onNewTab={() => setShowConnect(true)}
          onReorder={handleTabReorder}
          onClone={cloneTab}
          onDisconnect={disconnectTab}
          onReconnect={reconnectTab}
          onSplitRequest={(sourceTabId, direction) => {
            setSplitPicker({ sourceTabId, direction })
          }}
          onTabDragStart={handleTabDragStart}
          onTabDragEnd={handleTabDragEnd}
        />
        <div
          className="terminals"
          onDragOver={handleTerminalDragOver}
          onDragLeave={handleTerminalDragLeave}
          onDrop={handleTerminalDrop}
        >
          {tabs.map((tab) => {
            const split = splits.find((s) => s.tabA === tab.id || s.tabB === tab.id)
            const inSplit = !!split
            const splitActive = !!split && (activeTabId === split.tabA || activeTabId === split.tabB)
            const isTabA = split?.tabA === tab.id

            let style: React.CSSProperties = {}
            if (inSplit && split) {
              if (!splitActive) {
                // A different tab is active — this split is hidden entirely
                style = { display: 'none' }
              } else {
                const isVertical = split.direction === 'vertical'
                if (isVertical) {
                  if (isTabA) {
                    style = { position: 'absolute', left: 0, top: 0, bottom: 0, width: `calc(${split.ratio * 100}% - 2px)` }
                  } else {
                    style = { position: 'absolute', right: 0, top: 0, bottom: 0, width: `calc(${(1 - split.ratio) * 100}% - 2px)` }
                  }
                } else {
                  if (isTabA) {
                    style = { position: 'absolute', left: 0, right: 0, top: 0, height: `calc(${split.ratio * 100}% - 2px)` }
                  } else {
                    style = { position: 'absolute', left: 0, right: 0, bottom: 0, height: `calc(${(1 - split.ratio) * 100}% - 2px)` }
                  }
                }
              }
            } else if (tab.id === activeTabId) {
              style = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }
            } else {
              // Inactive standalone tab — hide the pane entirely so it
              // doesn't sit transparently above the active terminal and block clicks
              style = { display: 'none' }
            }

            return (
              <div
                key={tab.id}
                className={`terminal-pane${inSplit ? ' split-pane' : ''}${activeTabId === tab.id ? ' active-pane' : ''}`}
                style={style}
                onClick={() => { if (inSplit) setActiveTabId(tab.id) }}
              >
                <Terminal
                  tab={tab}
                  active={splitActive || tab.id === activeTabId}
                  onStatusChange={(status) => updateTabStatus(tab.id, status)}
                  aiEnabled={aiEnabled && aiOn}
                  copyOnSelect={copyOnSelect}
                />
                {inSplit && split && (
                  <button className="split-close-btn" onClick={(e) => { e.stopPropagation(); removeSplit(split.id) }} title="取消分屏">×</button>
                )}
              </div>
            )
          })}
          {splits
            .filter((s) => activeTabId === s.tabA || activeTabId === s.tabB)
            .map((split) => (
              <SplitHandle key={split.id} split={split} onUpdate={(ratio) => updateSplitRatio(split.id, ratio)} />
            ))}
          {tabs.length === 0 && (
            <div className="empty-state">
              <p>暂无活动连接</p>
              <button onClick={() => setShowConnect(true)}>新建连接</button>
            </div>
          )}
          {draggingTabId && splitDropZone && <SplitDropOverlay zone={splitDropZone} />}
        </div>
        {activeTab && activeTab.status === 'connected' && (
          <div className="toolbar">
            <button onClick={() => setFileManagerTabId(activeTab.id)}>文件管理</button>
            {aiEnabled && aiOn && (
              <button onClick={() => setShowAIPanel(!showAIPanel)}>
                {showAIPanel ? '关闭 AI' : 'AI 助手'}
              </button>
            )}
          </div>
        )}
      </div>
      {(showConnect || editingConnection) && (
        <ConnectionDialog
          onConnect={handleConnect}
          onSave={handleSaveOnly}
          onClose={closeDialog}
          editing={editingConnection}
        />
      )}
      {contextMenu && (
        <div className="ctx-overlay" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}>
          <div className="ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            {contextMenu.connection && (
              <>
                <div className="ctx-item" onClick={() => { connectSaved(contextMenu.connection!); setContextMenu(null) }}>连接</div>
                <div className="ctx-item" onClick={() => { editSavedConnection(contextMenu.connection!); setContextMenu(null) }}>编辑</div>
                <div className="ctx-sep" />
                <div className="ctx-item ctx-danger" onClick={() => { deleteSavedConnection(contextMenu.connection!.id); setContextMenu(null) }}>删除</div>
              </>
            )}
            {contextMenu.group && (
              <>
                <div className="ctx-item" onClick={() => {
                  setEditingGroupId(contextMenu.group!.id)
                  setEditingGroupName(contextMenu.group!.name)
                  setContextMenu(null)
                }}>重命名</div>
                <div className="ctx-sep" />
                <div className="ctx-item ctx-danger" onClick={() => { deleteGroup(contextMenu.group!.id); setContextMenu(null) }}>删除分组</div>
              </>
            )}
          </div>
        </div>
      )}
      {fileManagerTabId && (
        <FileManager
          sessionId={fileManagerTabId}
          onClose={() => setFileManagerTabId(null)}
        />
      )}
      {showSettings && (
        <SettingsDialog
          currentTheme={currentTheme}
          onApply={handleThemeApply}
          onClose={() => setShowSettings(false)}
        />
      )}
      <AIPanel
        visible={showAIPanel}
        sessionId={activeTabId}
        onClose={() => setShowAIPanel(false)}
        onExecute={handleAIExecute}
      />
      {/* Split picker modal — pick which tab to split with */}
      {splitPicker && (
        <div className="dialog-overlay" onClick={() => setSplitPicker(null)}>
          <div className="dialog split-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{splitPicker.direction === 'vertical' ? '左右分屏' : '上下分屏'} — 选择并排标签</h2>
            <ul className="split-picker-list">
              {tabs
                .filter((t) => t.id !== splitPicker.sourceTabId && t.status === 'connected')
                .map((t) => (
                  <li key={t.id} className="split-picker-item" onClick={() => {
                    const [tabA, tabB] = [splitPicker.sourceTabId, t.id]
                    createSplit(tabA, tabB, splitPicker.direction)
                    setSplitPicker(null)
                  }}>
                    <span className="split-picker-name">{t.title}</span>
                    <span className="split-picker-host">{t.config.host}:{t.config.port}</span>
                  </li>
                ))}
              {tabs.filter((t) => t.id !== splitPicker.sourceTabId && t.status === 'connected').length === 0 && (
                <li className="split-picker-empty">无其他已连接的标签。请先连接另一个 SSH 会话。</li>
              )}
            </ul>
            <div className="dialog-actions">
              <button onClick={() => setSplitPicker(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
