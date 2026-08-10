import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import BroadcastBar from '../../src/renderer/src/components/BroadcastBar'
import { Tab } from '../../src/renderer/src/types'

function makeTab(id: string, title: string, status: Tab['status'] = 'connected'): Tab {
  return {
    id,
    title,
    config: {
      name: title,
      host: '192.168.1.1',
      port: 22,
      username: 'root'
    },
    status
  }
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    tabs: [
      makeTab('tab-1', 'Server A'),
      makeTab('tab-2', 'Server B'),
      makeTab('tab-3', 'Server C', 'disconnected')
    ],
    onSend: vi.fn(),
    ...overrides
  }
}

describe('BroadcastBar', () => {
  it('sends command with newline to all connected tabs in "all" mode', () => {
    const onSend = vi.fn()
    render(<BroadcastBar {...makeProps({ onSend })} />)

    const input = screen.getByPlaceholderText(/输入命令/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ls -la' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledTimes(1)
    const [ids, cmd] = onSend.mock.calls[0]
    expect(ids).toEqual(['tab-1', 'tab-2'])
    expect(cmd).toBe('ls -la')
    expect(input.value).toBe('')
  })

  it('excludes disconnected tabs from targets', () => {
    const onSend = vi.fn()
    render(<BroadcastBar {...makeProps({ onSend })} />)

    const input = screen.getByPlaceholderText(/输入命令/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'whoami' } })
    fireEvent.click(screen.getByText('发送'))

    expect(onSend).toHaveBeenCalledWith(['tab-1', 'tab-2'], 'whoami')
  })

  it('does not send when input is empty', () => {
    const onSend = vi.fn()
    render(<BroadcastBar {...makeProps({ onSend })} />)

    const sendBtn = screen.getByText('发送') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
    fireEvent.click(sendBtn)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows target count', () => {
    render(<BroadcastBar {...makeProps()} />)
    expect(screen.getByText('2/2 个会话')).toBeDefined()
  })

  it('switches to select mode and only sends to checked tabs', () => {
    const onSend = vi.fn()
    render(<BroadcastBar {...makeProps({ onSend })} />)

    fireEvent.click(screen.getByText('选择'))

    // Open picker — all connected tabs selected by default
    fireEvent.click(screen.getByText('2/2 个会话'))
    fireEvent.click(screen.getByText('Server B'))

    const input = screen.getByPlaceholderText(/输入命令/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hostname' } })
    fireEvent.click(screen.getByText('发送'))

    expect(onSend).toHaveBeenCalledWith(['tab-1'], 'hostname')
  })

  it('clears all selection in picker disables send', () => {
    const onSend = vi.fn()
    render(<BroadcastBar {...makeProps({ onSend })} />)

    fireEvent.click(screen.getByText('选择'))
    fireEvent.click(screen.getByText('2/2 个会话'))
    fireEvent.click(screen.getByText('清空'))

    expect(screen.getByText('0/2 个会话')).toBeDefined()

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('recalls previous command with ArrowUp', () => {
    const onSend = vi.fn()
    render(<BroadcastBar {...makeProps({ onSend })} />)

    const input = screen.getByPlaceholderText(/输入命令/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'df -h' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('df -h')
  })
})
