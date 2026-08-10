import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock execCommand from ssh.ts BEFORE importing the module under test
vi.mock('../../src/main/ssh', () => ({
  execCommand: vi.fn(),
  getSession: vi.fn()
}))

import { execCommand } from '../../src/main/ssh'
import { AI_PRESETS, collectSystemInfo, clearSystemInfoCache, classifyAndProcess, AIConfig, AIResult } from '../../src/main/ai'

// ─── AI_PRESETS ───────────────────────────────────────────────────────

describe('AI_PRESETS', () => {
  it('contains all supported providers', () => {
    expect(AI_PRESETS).toHaveProperty('OpenAI')
    expect(AI_PRESETS).toHaveProperty('DeepSeek')
    expect(AI_PRESETS).toHaveProperty('通义千问')
    expect(AI_PRESETS).toHaveProperty('Kimi')
    expect(AI_PRESETS).toHaveProperty('智谱')
    expect(AI_PRESETS).toHaveProperty('Ollama')
    expect(AI_PRESETS).toHaveProperty('自定义')
  })

  it('each preset has apiUrl and model', () => {
    for (const [name, preset] of Object.entries(AI_PRESETS)) {
      expect(preset).toHaveProperty('apiUrl')
      expect(preset).toHaveProperty('model')
      if (name !== '自定义') {
        expect(preset.apiUrl).toBeTruthy()
        expect(preset.model).toBeTruthy()
      }
    }
  })
})

// ─── collectSystemInfo ────────────────────────────────────────────────

describe('collectSystemInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSystemInfoCache('test-session')
  })

  it('collects and formats system info from execCommand results', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux myhost 6.1.0 x86_64 GNU/Linux')
      .mockResolvedValueOnce('PRETTY_NAME="Ubuntu 22.04"')
      .mockResolvedValueOnce('root')

    const info = await collectSystemInfo('test-session')
    expect(info).toContain('Linux myhost')
    expect(info).toContain('Ubuntu 22.04')
    expect(info).toContain('root')
  })

  it('caches result and returns cached on second call', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Darwin arm64')
      .mockResolvedValueOnce('macOS')
      .mockResolvedValueOnce('admin')

    const first = await collectSystemInfo('test-session')
    // Second call should use cache, not call execCommand again
    const second = await collectSystemInfo('test-session')
    expect(second).toBe(first)
    expect(vi.mocked(execCommand)).toHaveBeenCalledTimes(3) // only first call
  })

  it('different sessions have separate caches', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux A')
      .mockResolvedValueOnce('OS A')
      .mockResolvedValueOnce('userA')
      .mockResolvedValueOnce('Linux B')
      .mockResolvedValueOnce('OS B')
      .mockResolvedValueOnce('userB')

    const infoA = await collectSystemInfo('session-A')
    const infoB = await collectSystemInfo('session-B')
    expect(infoA).not.toBe(infoB)
    expect(infoA).toContain('Linux A')
    expect(infoB).toContain('Linux B')
  })

  it('handles execCommand errors gracefully', async () => {
    vi.mocked(execCommand)
      .mockRejectedValueOnce(new Error('Command failed'))
      .mockResolvedValueOnce('OS ok')
      .mockResolvedValueOnce('user ok')

    const info = await collectSystemInfo('test-session')
    expect(info).toContain('(unavailable)')
    expect(info).toContain('OS ok')
    expect(info).toContain('user ok')
  })
})

// ─── classifyAndProcess ──────────────────────────────────────────────

describe('classifyAndProcess', () => {
  const baseConfig: AIConfig = {
    provider: 'OpenAI',
    apiUrl: 'https://api.openai.com',
    apiKey: 'sk-test',
    model: 'gpt-4o'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    clearSystemInfoCache('test-session')
  })

  it('returns error when AI config is missing apiUrl', async () => {
    const badConfig: AIConfig = { ...baseConfig, apiUrl: '' }
    const result = await classifyAndProcess('test-session', 'ls', badConfig)
    expect(result.type).toBe('error')
  })

  it('returns error when AI config is missing model', async () => {
    const badConfig: AIConfig = { ...baseConfig, model: '' }
    const result = await classifyAndProcess('test-session', 'ls', badConfig)
    expect(result.type).toBe('error')
  })

  it('returns command type for direct shell commands (mocked fetch)', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux x86_64')
      .mockResolvedValueOnce('Ubuntu')
      .mockResolvedValueOnce('root')

    // Mock fetch to return a "command" classification
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"type":"command","cmd":"ls -la"}' } }]
      })
    })

    const result = await classifyAndProcess('test-session', 'ls -la', baseConfig)
    expect(result.type).toBe('command')
    expect(result.cmd).toBe('ls -la')
  })

  it('returns ai type with explanation for natural language queries', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux x86_64')
      .mockResolvedValueOnce('Ubuntu')
      .mockResolvedValueOnce('root')

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"type":"ai","cmd":"df -h","explain":"查看磁盘使用情况"}' } }]
      })
    })

    const result = await classifyAndProcess('test-session', '查看磁盘使用情况', baseConfig)
    expect(result.type).toBe('ai')
    expect(result.cmd).toBe('df -h')
    expect(result.explain).toBe('查看磁盘使用情况')
  })

  it('extracts JSON from markdown-wrapped response', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux x86_64')
      .mockResolvedValueOnce('Ubuntu')
      .mockResolvedValueOnce('root')

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '```json\n{"type":"command","cmd":"docker ps"}\n```' } }]
      })
    })

    const result = await classifyAndProcess('test-session', 'docker ps', baseConfig)
    expect(result.type).toBe('command')
    expect(result.cmd).toBe('docker ps')
  })

  it('retries once when no JSON found in first response', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux x86_64')
      .mockResolvedValueOnce('Ubuntu')
      .mockResolvedValueOnce('root')

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Sure, here is the command: docker ps' } }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"type":"command","cmd":"docker ps"}' } }]
        })
      })

    const result = await classifyAndProcess('test-session', 'docker ps', baseConfig)
    expect(result.cmd).toBe('docker ps')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns error when API call fails', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux x86_64')
      .mockResolvedValueOnce('Ubuntu')
      .mockResolvedValueOnce('root')

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await classifyAndProcess('test-session', 'test', baseConfig)
    expect(result.type).toBe('error')
  })

  it('returns error on non-ok API response', async () => {
    vi.mocked(execCommand)
      .mockResolvedValueOnce('Linux x86_64')
      .mockResolvedValueOnce('Ubuntu')
      .mockResolvedValueOnce('root')

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized')
    })

    const result = await classifyAndProcess('test-session', 'test', baseConfig)
    expect(result.type).toBe('error')
  })
})
