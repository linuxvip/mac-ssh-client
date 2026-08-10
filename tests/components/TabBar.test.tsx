import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import TabBar from '../../src/renderer/src/components/TabBar'
import { Tab } from '../../src/renderer/src/types'

// Sample tabs for testing
function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1',
    title: 'root@192.168.1.1',
    config: {
      name: 'Test Server',
      host: '192.168.1.1',
      port: 22,
      username: 'root'
    },
    status: 'connected',
    ...overrides
  }
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    tabs: [makeTab()],
    activeTabId: 'tab-1',
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onNewTab: vi.fn(),
    onReorder: vi.fn(),
    onClone: vi.fn(),
    onDisconnect: vi.fn(),
    onReconnect: vi.fn(),
    onSplitRequest: vi.fn(),
    onSplitDrag: vi.fn(),
    ...overrides
  }
}

describe('TabBar', () => {
  // ─── Rendering ────────────────────────────────────────────────────

  it('renders tab titles', () => {
    render(<TabBar {...makeProps()} />)
    expect(screen.getByText('root@192.168.1.1')).toBeDefined()
  })

  it('renders new tab button', () => {
    const onNewTab = vi.fn()
    render(<TabBar {...makeProps({ onNewTab })} />)
    const btn = screen.getByTitle('New connection')
    fireEvent.click(btn)
    expect(onNewTab).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect when a tab is clicked', () => {
    const onSelect = vi.fn()
    render(<TabBar {...makeProps({ onSelect })} />)
    fireEvent.click(screen.getByText('root@192.168.1.1'))
    expect(onSelect).toHaveBeenCalledWith('tab-1')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<TabBar {...makeProps({ onClose })} />)
    const closeBtn = screen.getByText('×')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledWith('tab-1')
  })

  it('renders multiple tabs', () => {
    const props = makeProps({
      tabs: [
        makeTab({ id: 'tab-1', title: 'Server A' }),
        makeTab({ id: 'tab-2', title: 'Server B' }),
        makeTab({ id: 'tab-3', title: 'Server C' })
      ],
      activeTabId: 'tab-2'
    })
    render(<TabBar {...props} />)
    expect(screen.getByText('Server A')).toBeDefined()
    expect(screen.getByText('Server B')).toBeDefined()
    expect(screen.getByText('Server C')).toBeDefined()
  })

  // ─── Status dot classes ────────────────────────────────────────────

  it('applies correct status class for connected tab', () => {
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'connected' })]
    })} />)
    const tab = container.querySelector('.tab')
    expect(tab?.className).toContain('status-connected')
  })

  it('applies correct status class for disconnected tab', () => {
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'disconnected' })]
    })} />)
    const tab = container.querySelector('.tab')
    expect(tab?.className).toContain('status-disconnected')
  })

  it('applies correct status class for error tab', () => {
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'error' })]
    })} />)
    const tab = container.querySelector('.tab')
    expect(tab?.className).toContain('status-error')
  })

  // ─── Context menu — connected tab ──────────────────────────────────

  it('shows context menu on right-click (connected tab)', () => {
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'connected' })]
    })} />)

    const tab = container.querySelector('.tab')!
    fireEvent.contextMenu(tab, { clientX: 100, clientY: 200 })

    // Should show "克隆会话", "左右分屏", "上下分屏", and "断开连接"
    expect(screen.getByText('克隆会话')).toBeDefined()
    expect(screen.getByText('左右分屏 ▸')).toBeDefined()
    expect(screen.getByText('上下分屏 ▸')).toBeDefined()
    expect(screen.getByText('断开连接')).toBeDefined()
  })

  it('calls onClone when clicking "克隆会话" in context menu', () => {
    const onClone = vi.fn()
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'connected' })],
      onClone
    })} />)

    fireEvent.contextMenu(container.querySelector('.tab')!, { clientX: 100, clientY: 200 })
    fireEvent.click(screen.getByText('克隆会话'))
    expect(onClone).toHaveBeenCalledWith('tab-1')
  })

  it('calls onDisconnect when clicking "断开连接" in context menu', () => {
    const onDisconnect = vi.fn()
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'connected' })],
      onDisconnect
    })} />)

    fireEvent.contextMenu(container.querySelector('.tab')!, { clientX: 100, clientY: 200 })
    fireEvent.click(screen.getByText('断开连接'))
    expect(onDisconnect).toHaveBeenCalledWith('tab-1')
  })

  // ─── Context menu — disconnected tab ───────────────────────────────

  it('shows "重新连接" instead of "断开连接" for disconnected tab', () => {
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'disconnected' })]
    })} />)

    fireEvent.contextMenu(container.querySelector('.tab')!, { clientX: 100, clientY: 200 })

    expect(screen.getByText('克隆会话')).toBeDefined()
    expect(screen.getByText('重新连接')).toBeDefined()
    expect(screen.queryByText('断开连接')).toBeNull()
  })

  it('calls onReconnect when clicking "重新连接"', () => {
    const onReconnect = vi.fn()
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'disconnected' })],
      onReconnect
    })} />)

    fireEvent.contextMenu(container.querySelector('.tab')!, { clientX: 100, clientY: 200 })
    fireEvent.click(screen.getByText('重新连接'))
    expect(onReconnect).toHaveBeenCalledWith('tab-1')
  })

  // ─── Context menu — dismissed ──────────────────────────────────────

  it('dismisses context menu when clicking overlay', () => {
    const { container } = render(<TabBar {...makeProps({
      tabs: [makeTab({ id: 'tab-1', status: 'connected' })]
    })} />)

    fireEvent.contextMenu(container.querySelector('.tab')!, { clientX: 100, clientY: 200 })
    expect(screen.getByText('克隆会话')).toBeDefined()

    // Click the overlay
    const overlay = container.querySelector('.ctx-overlay')!
    fireEvent.click(overlay)
    expect(screen.queryByText('克隆会话')).toBeNull()
  })
})
