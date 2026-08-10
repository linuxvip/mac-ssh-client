import { BrowserWindow } from 'electron'
import { execCommand } from './ssh'

interface MonitorData {
  cpu: number
  mem: { used: number; total: number; percent: number }
  disk: { used: number; total: number; percent: number }
  net: { rx: number; tx: number }
}

interface MonitorState {
  timer: ReturnType<typeof setInterval>
  prevNet: { rx: number; tx: number; ts: number } | null
  prevCpu: { idle: number; total: number } | null
}

const monitors = new Map<string, MonitorState>()

const CMD = [
  'head -1 /proc/stat',
  'echo "---SEP---"',
  'cat /proc/meminfo | head -3',
  'echo "---SEP---"',
  'df -B1 / | tail -1',
  'echo "---SEP---"',
  'cat /proc/net/dev',
  'echo "---SEP---"',
  'date +%s%N'
].join('; ')

function parseCpuLine(line: string): { idle: number; total: number } | null {
  const m = line.match(/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
  if (!m) return null
  const vals = m.slice(1).map(Number)
  const idle = vals[3] + vals[4]
  const total = vals.reduce((a, b) => a + b, 0)
  return { idle, total }
}

function parseMemInfo(text: string): { used: number; total: number; percent: number } | null {
  const lines = text.trim().split('\n')
  let total = 0
  let free = 0
  let available = 0
  for (const line of lines) {
    const m = line.match(/^(\w+):\s+(\d+)/)
    if (!m) continue
    const val = parseInt(m[2]) * 1024 // /proc/meminfo is in kB
    if (m[1] === 'MemTotal') total = val
    else if (m[1] === 'MemFree') free = val
    else if (m[1] === 'MemAvailable') available = val
  }
  if (total === 0) return null
  // used = total - available (more accurate than total - free)
  const used = available > 0 ? total - available : total - free
  return { used, total, percent: (used / total) * 100 }
}

function parseDiskLine(line: string): { used: number; total: number; percent: number } | null {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 4) return null
  const total = parseInt(parts[1])
  const used = parseInt(parts[2])
  if (isNaN(total) || isNaN(used) || total === 0) return null
  return { used, total, percent: (used / total) * 100 }
}

function parseNetDev(text: string): { rx: number; tx: number } {
  let rx = 0
  let tx = 0
  for (const line of text.split('\n')) {
    if (!line.includes(':') || line.includes('|')) continue
    const parts = line.split(':')[1]?.trim().split(/\s+/)
    if (!parts || parts.length < 10) continue
    const iface = line.split(':')[0].trim()
    if (iface === 'lo') continue
    rx += parseInt(parts[0]) || 0
    tx += parseInt(parts[8]) || 0
  }
  return { rx, tx }
}

export function startMonitor(sender: Electron.WebContents, sessionId: string): void {
  if (monitors.has(sessionId)) return

  const state: MonitorState = {
    timer: null as any,
    prevNet: null,
    prevCpu: null
  }

  async function poll(): Promise<void> {
    try {
      const output = await execCommand(sessionId, CMD)
      const sections = output.split('---SEP---')
      if (sections.length < 5) return

      // CPU — delta between polls
      const cpuNow = parseCpuLine(sections[0].trim())
      let cpuPercent = 0
      if (cpuNow && state.prevCpu) {
        const dTotal = cpuNow.total - state.prevCpu.total
        const dIdle = cpuNow.idle - state.prevCpu.idle
        cpuPercent = dTotal > 0 ? ((dTotal - dIdle) / dTotal) * 100 : 0
      }
      state.prevCpu = cpuNow

      // Memory — use /proc/meminfo for accurate available memory
      const mem = parseMemInfo(sections[1]) || { used: 0, total: 0, percent: 0 }

      // Disk
      const disk = parseDiskLine(sections[2].trim()) || { used: 0, total: 0, percent: 0 }

      // Network — use remote timestamp for accurate dt
      const netNow = parseNetDev(sections[3])
      const remoteTs = parseInt(sections[4].trim()) / 1e6 // nanoseconds -> milliseconds
      let netSpeed = { rx: 0, tx: 0 }
      if (state.prevNet && remoteTs > 0) {
        const dt = (remoteTs - state.prevNet.ts) / 1000
        if (dt > 0.5) {
          netSpeed = {
            rx: Math.max(0, (netNow.rx - state.prevNet.rx) / dt),
            tx: Math.max(0, (netNow.tx - state.prevNet.tx) / dt)
          }
        }
      }
      if (remoteTs > 0) {
        state.prevNet = { ...netNow, ts: remoteTs }
      }

      const data: MonitorData = {
        cpu: cpuPercent,
        mem,
        disk,
        net: netSpeed
      }

      if (!sender.isDestroyed()) {
        sender.send('monitor:data', sessionId, data)
      }
    } catch {
      // Session may have been closed, ignore
    }
  }

  poll()
  state.timer = setInterval(poll, 2000)
  monitors.set(sessionId, state)
}

export function stopMonitor(sessionId: string): void {
  const state = monitors.get(sessionId)
  if (state) {
    clearInterval(state.timer)
    monitors.delete(sessionId)
  }
}
