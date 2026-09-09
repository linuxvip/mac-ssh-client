import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { Tab } from '../types'

function getTermTheme(): { background: string; foreground: string; cursor: string; selectionBackground: string } {
  const s = getComputedStyle(document.documentElement)
  return {
    background: s.getPropertyValue('--term-bg').trim() || '#1e1e1e',
    foreground: s.getPropertyValue('--term-fg').trim() || '#d4d4d4',
    cursor: s.getPropertyValue('--term-cursor').trim() || '#d4d4d4',
    selectionBackground: s.getPropertyValue('--term-selection').trim() || 'rgba(255,255,255,0.25)'
  }
}

function isLightColor(color: string): boolean {
  const m = color.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return false
  const n = parseInt(m[1], 16)
  return (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) > 140
}

function getSearchDecorations(): {
  matchBackground: string
  matchBorder: string
  matchOverviewRuler: string
  activeMatchBackground: string
  activeMatchBorder: string
  activeMatchColorOverviewRuler: string
} {
  if (isLightColor(getTermTheme().background)) {
    return {
      matchBackground: '#fff2b8',
      matchBorder: '#e0a800',
      matchOverviewRuler: '#e0a800',
      activeMatchBackground: '#ffd166',
      activeMatchBorder: '#ff7b00',
      activeMatchColorOverviewRuler: '#ff7b00'
    }
  }
  return {
    matchBackground: '#4a3c00',
    matchBorder: '#c8960c',
    matchOverviewRuler: '#c8960c',
    activeMatchBackground: '#7a4a00',
    activeMatchBorder: '#ffa500',
    activeMatchColorOverviewRuler: '#ffa500'
  }
}

// AI trigger prefix — only input starting with this will be sent to AI
const AI_PREFIX = '?'

// Check if a character is Chinese
function isChinese(ch: string): boolean {
  return /[\u4e00-\u9fff]/.test(ch)
}

export const DEFAULT_FONT_FAMILY = 'Menlo, Monaco, "Courier New", monospace'
export const DEFAULT_FONT_SIZE = 14
export const DEFAULT_SCROLLBACK = 1000

interface Props {
  tab: Tab
  active: boolean
  onStatusChange: (status: Tab['status']) => void
  aiEnabled?: boolean
  copyOnSelect?: boolean
  fontFamily?: string
  fontSize?: number
  scrollback?: number
}

export default function Terminal({ tab, active, onStatusChange, aiEnabled, copyOnSelect, fontFamily, fontSize, scrollback }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef(active)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState({ resultIndex: -1, resultCount: 0 })
  const inputBufferRef = useRef('')
  const aiEnabledRef = useRef(aiEnabled)
  const aiInputModeRef = useRef(false) // true = current line is AI query (local echo)
  // AI inline state: pending command waiting for user confirmation
  const pendingAICmdRef = useRef<string | null>(null)
  const aiLoadingRef = useRef(false)
  // Copy on select
  const copyOnSelectRef = useRef(copyOnSelect)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep ref in sync with prop so the onData closure always sees the latest value
  useEffect(() => {
    aiEnabledRef.current = !!aiEnabled
  }, [aiEnabled])

  useEffect(() => {
    copyOnSelectRef.current = !!copyOnSelect
  }, [copyOnSelect])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (!activeRef.current) return
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (e.key.toLowerCase() !== 'f') return
      const container = containerRef.current
      if (!container || !container.contains(document.activeElement)) return
      e.preventDefault()
      e.stopPropagation()
      setSearchOpen(true)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  function findNextMatch(): void {
    const addon = searchAddonRef.current
    if (addon && searchTerm) addon.findNext(searchTerm, { incremental: false, decorations: getSearchDecorations() })
  }

  function findPrevMatch(): void {
    const addon = searchAddonRef.current
    if (addon && searchTerm) addon.findPrevious(searchTerm, { incremental: false, decorations: getSearchDecorations() })
  }

  function closeSearch(): void {
    setSearchOpen(false)
    setSearchTerm('')
    setSearchResults({ resultIndex: -1, resultCount: 0 })
    searchAddonRef.current?.clearDecorations()
    xtermRef.current?.focus()
  }

  const sendToTerminal = useCallback((cmd: string) => {
    window.api.ssh.send(tab.id, cmd)
  }, [tab.id])

  useEffect(() => {
    if (!containerRef.current) return

    try {
    const colors = getTermTheme()
    const term = new XTerm({
      allowProposedApi: true,
      cursorBlink: true,
      fontSize: fontSize ?? DEFAULT_FONT_SIZE,
      fontFamily: fontFamily || DEFAULT_FONT_FAMILY,
      scrollback: scrollback ?? DEFAULT_SCROLLBACK,
      theme: { background: colors.background, foreground: colors.foreground, cursor: colors.cursor, selectionBackground: colors.selectionBackground }
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    const searchAddon = new SearchAddon()
    term.loadAddon(searchAddon)
    searchAddonRef.current = searchAddon
    searchAddon.onDidChangeResults((r) => setSearchResults(r))
    try {
      const graphemesAddon = new UnicodeGraphemesAddon()
      term.loadAddon(graphemesAddon)
      term.unicode.activeVersion = '15'
    } catch {
      try {
        const unicodeAddon = new Unicode11Addon()
        term.loadAddon(unicodeAddon)
        term.unicode.activeVersion = '11'
      } catch (e) {
        console.warn('Unicode addon load failed:', e)
      }
    }
    term.open(containerRef.current)
    // Delay fit to ensure container has layout dimensions
    requestAnimationFrame(() => fitAddon.fit())
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Connect SSH
    term.writeln('正在连接...\r\n')
    window.api.ssh
      .connect({ ...tab.config, sessionId: tab.id })
      .then((result: { success: boolean; error?: string }) => {
        if (result.success) {
          onStatusChange('connected')
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
          }
          const { cols, rows } = term
          window.api.ssh.resize(tab.id, cols, rows)
          term.focus()
        } else {
          term.writeln(`\r\n\x1b[31m连接失败: ${result.error || '未知错误'}\x1b[0m`)
          onStatusChange('error')
        }
      })
      .catch((err: Error) => {
        term.writeln(`\r\n\x1b[31m连接失败: ${err.message}\x1b[0m`)
        onStatusChange('error')
      })

    // Debounced resize to force TUI apps (like Claude Code) to redraw
    // after output settles — fixes cursor misalignment from width table mismatches
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleResync(): void {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const { cols, rows } = term
        // Send same-size resize to trigger SIGWINCH on remote
        window.api.ssh.resize(tab.id, cols, rows)
      }, 150)
    }

    // Track alternate screen mode (vi, nano, top, less, man, etc.)
    // When in alternate screen, disable AI interception completely
    let inAlternateScreen = false

    // Receive output
    const unsubOutput = window.api.ssh.onOutput(tab.id, (data: string) => {
      term.write(data)
      if (/\x1b\[\?(?:1049|47|1047)h/.test(data)) {
        inAlternateScreen = true
      }
      if (/\x1b\[\?(?:1049|47|1047)l/.test(data)) {
        inAlternateScreen = false
        inputBufferRef.current = ''
      }
      scheduleResync()
    })

    // Session closed
    const unsubClosed = window.api.ssh.onClosed(tab.id, () => {
      term.writeln('\r\n\x1b[33m[连接已断开]\x1b[0m')
      onStatusChange('disconnected')
    })

    // Send input — with AI interception
    // Rule: first char is Chinese or '?' → AI mode (local echo, Enter sends to AI)
    //        first char is ASCII → normal mode (100% pass to terminal)
    term.onData((data) => {
      // AI disabled or in TUI → pass everything through
      if (!aiEnabledRef.current || inAlternateScreen) {
        sendToTerminal(data)
        return
      }

      // AI loading → block input
      if (aiLoadingRef.current) return

      // Pending AI command → handle confirm/cancel
      if (pendingAICmdRef.current !== null) {
        if (data === '\r') {
          const cmd = pendingAICmdRef.current
          pendingAICmdRef.current = null
          term.writeln('')
          sendToTerminal(cmd + '\r')
        } else if (data === '\x1b' || data === '\x03') {
          pendingAICmdRef.current = null
          term.writeln('\r\n\x1b[33m[已取消]\x1b[0m')
          sendToTerminal('\r')
        }
        return
      }

      // --- Enter key ---
      if (data === '\r') {
        const buf = inputBufferRef.current
        inputBufferRef.current = ''

        if (aiInputModeRef.current) {
          aiInputModeRef.current = false
          term.write('\x1b[0m') // reset color
          const query = buf.replace(/^\?/, '').trim()
          if (!query) {
            // Empty AI query → just send enter
            sendToTerminal(data)
            return
          }

          // Send \r to get remote prompt in sync, then show AI indicator
          sendToTerminal('\r')
          aiLoadingRef.current = true
          term.writeln('\x1b[90m⏳ AI 处理中...\x1b[0m')

          ;(window as any).api.ai.process(tab.id, query).then((result: any) => {
            aiLoadingRef.current = false
            if (result.type === 'error') {
              term.writeln(`\x1b[31m❌ ${result.error}\x1b[0m`)
            } else if (result.cmd) {
              if (result.explain) {
                term.writeln(`\x1b[36m💡 ${result.explain}\x1b[0m`)
              }
              term.writeln(`\x1b[32m$ ${result.cmd}\x1b[0m`)
              term.write('\x1b[90m[Enter 执行 | Esc 取消]\x1b[0m')
              pendingAICmdRef.current = result.cmd
            }
          }).catch((err: any) => {
            aiLoadingRef.current = false
            term.writeln(`\x1b[31m❌ ${err.message || '请求失败'}\x1b[0m`)
          })
          return
        }

        // Normal mode → pass through
        sendToTerminal(data)
        return
      }

      // --- Backspace ---
      if (data === '\x7f') {
        if (aiInputModeRef.current) {
          if (inputBufferRef.current.length > 0) {
            const lastChar = inputBufferRef.current[inputBufferRef.current.length - 1]
            inputBufferRef.current = inputBufferRef.current.slice(0, -1)
            // Erase from screen: wide char = 2 columns
            if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(lastChar)) {
              term.write('\b \b\b \b')
            } else {
              term.write('\b \b')
            }
            // If buffer emptied, exit AI mode
            if (inputBufferRef.current.length === 0) {
              aiInputModeRef.current = false
              term.write('\x1b[0m')
            }
          }
        } else {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          sendToTerminal(data)
        }
        return
      }

      // --- Control chars (Ctrl+C, Ctrl+D, etc.) ---
      if (data.length === 1 && data.charCodeAt(0) < 32) {
        if (aiInputModeRef.current) {
          // Cancel AI input, erase local echo
          aiInputModeRef.current = false
          const displayWidth = [...inputBufferRef.current].reduce((w, ch) =>
            w + (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1), 0)
          for (let i = 0; i < displayWidth; i++) term.write('\b \b')
          term.write('\x1b[0m')
          inputBufferRef.current = ''
          sendToTerminal(data)
        } else {
          inputBufferRef.current = ''
          sendToTerminal(data)
        }
        return
      }

      // --- Printable input ---
      const isFirstChar = inputBufferRef.current.length === 0
      inputBufferRef.current += data

      // Detect AI mode on first character of the line
      if (isFirstChar) {
        const ch = data[0]
        if (isChinese(ch) || ch === AI_PREFIX) {
          aiInputModeRef.current = true
          term.write('\x1b[36m') // cyan color for AI input
          term.write(data)
          return
        }
      }

      if (aiInputModeRef.current) {
        // Continue local echo in AI mode
        term.write(data)
      } else {
        // Normal: send to terminal
        sendToTerminal(data)
      }
    })

    // Resize
    term.onResize(({ cols, rows }) => {
      window.api.ssh.resize(tab.id, cols, rows)
    })

    // Copy on select — debounced so it only fires when mouse is released
    let selectionTimer: ReturnType<typeof setTimeout> | null = null
    const unsubSelection = term.onSelectionChange(() => {
      if (!copyOnSelectRef.current) return
      if (selectionTimer) clearTimeout(selectionTimer)
      selectionTimer = setTimeout(() => {
        const text = term.getSelection()
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            // Show toast
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
            setCopied(true)
            copyTimerRef.current = setTimeout(() => setCopied(false), 1500)
          }).catch(() => {})
        }
        selectionTimer = null
      }, 100)
    })

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      if (selectionTimer) clearTimeout(selectionTimer)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      unsubOutput()
      unsubClosed()
      unsubSelection.dispose()
      term.dispose()
    }
    } catch (err) {
      console.error('[Terminal] Init error:', err)
      onStatusChange('error')
    }
  }, [tab.id])

  useEffect(() => {
    if (active && fitAddonRef.current) {
      // Use rAF to wait for layout update (e.g. toolbar appearing)
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit()
        xtermRef.current?.focus()
      })
    }
  }, [active, tab.status])

  // Live font family/size updates from settings — no terminal rebuild needed
  useEffect(() => {
    const term = xtermRef.current
    if (!term || !fitAddonRef.current) return
    term.options.fontFamily = fontFamily || DEFAULT_FONT_FAMILY
    term.options.fontSize = fontSize ?? DEFAULT_FONT_SIZE
    term.options.scrollback = scrollback ?? DEFAULT_SCROLLBACK
    fitAddonRef.current.fit()
    const { cols, rows } = term
    window.api.ssh.resize(tab.id, cols, rows)
  }, [fontFamily, fontSize, scrollback, tab.id])

  useEffect(() => {
    const addon = searchAddonRef.current
    if (!addon) return
    if (!searchOpen || !searchTerm) {
      addon.clearDecorations()
      setSearchResults({ resultIndex: -1, resultCount: 0 })
      return
    }
    addon.findNext(searchTerm, { incremental: true, decorations: getSearchDecorations() })
  }, [searchTerm, searchOpen])

  // Refit when the container/pane size changes (window resize, split ratio,
  // split create/remove) — window 'resize' alone misses pane-level changes
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    let rafId: number | null = null

    const scheduleFit = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        fitAddonRef.current?.fit()
      })
    }

    const observer = new ResizeObserver(scheduleFit)
    observer.observe(container)
    window.addEventListener('resize', scheduleFit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleFit)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [active])

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ display: active ? 'block' : 'none' }}
    >
      {copied && <div className="copy-toast">已复制</div>}
      {searchOpen && (
        <div className="term-search-bar">
          <input
            ref={searchInputRef}
            className="term-search-input"
            value={searchTerm}
            placeholder="搜索终端内容..."
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey) findPrevMatch()
                else findNextMatch()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                closeSearch()
              }
            }}
          />
          <span className="term-search-count">
            {searchTerm
              ? searchResults.resultCount > 0
                ? `${searchResults.resultIndex + 1}/${searchResults.resultCount}`
                : '无匹配'
              : ''}
          </span>
          <button className="term-search-btn" onClick={findPrevMatch} title="上一个 (Shift+Enter)">↑</button>
          <button className="term-search-btn" onClick={findNextMatch} title="下一个 (Enter)">↓</button>
          <button className="term-search-btn" onClick={closeSearch} title="关闭 (Esc)">×</button>
        </div>
      )}
    </div>
  )
}
