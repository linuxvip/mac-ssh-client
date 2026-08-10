import { describe, it, expect } from 'vitest'

// Inline the monitor parsing functions for pure unit testing (no Electron dependency)
// These are the exact functions from src/main/monitor.ts

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
    const val = parseInt(m[2]) * 1024
    if (m[1] === 'MemTotal') total = val
    else if (m[1] === 'MemFree') free = val
    else if (m[1] === 'MemAvailable') available = val
  }
  if (total === 0) return null
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

// ─── Tests ────────────────────────────────────────────────────────────

describe('parseCpuLine', () => {
  it('parses a standard /proc/stat cpu line', () => {
    // user nice system idle iowait irq softirq steal
    const result = parseCpuLine('cpu  100 20 300 4000 50 10 0 0')
    expect(result).not.toBeNull()
    expect(result!.idle).toBe(4000 + 50)   // idle + iowait
    expect(result!.total).toBe(100 + 20 + 300 + 4000 + 50 + 10 + 0 + 0)
  })

  it('returns null for non-cpu lines', () => {
    expect(parseCpuLine('cpu0 100 20 300 400 50 10 0 0')).toBeNull()
    expect(parseCpuLine('intr 12345')).toBeNull()
    expect(parseCpuLine('')).toBeNull()
  })

  it('handles large numbers', () => {
    const result = parseCpuLine('cpu  99999999 88888888 77777777 66666666 55555555 44444444 33333333 22222222')
    expect(result).not.toBeNull()
    expect(result!.total).toBeGreaterThan(0)
  })
})

describe('parseMemInfo', () => {
  it('parses standard /proc/meminfo with MemAvailable', () => {
    const text = `MemTotal:       16384000 kB
MemFree:         4000000 kB
MemAvailable:   12000000 kB`
    const result = parseMemInfo(text)
    expect(result).not.toBeNull()
    expect(result!.total).toBe(16384000 * 1024)
    // used = total - available
    expect(result!.used).toBe((16384000 - 12000000) * 1024)
    expect(result!.percent).toBeCloseTo(26.76, 0)
  })

  it('falls back to total - free when no MemAvailable', () => {
    const text = `MemTotal:       16384000 kB
MemFree:         4000000 kB`
    const result = parseMemInfo(text)
    expect(result).not.toBeNull()
    expect(result!.used).toBe((16384000 - 4000000) * 1024)
  })

  it('returns null for empty input', () => {
    expect(parseMemInfo('')).toBeNull()
  })

  it('handles exact values producing correct percent', () => {
    const text = `MemTotal:       10000 kB
MemFree:              0 kB
MemAvailable:      5000 kB`
    const result = parseMemInfo(text)
    expect(result).not.toBeNull()
    expect(result!.percent).toBe(50)
  })
})

describe('parseDiskLine', () => {
  it('parses df -B1 output', () => {
    // df -B1 / | tail -1:  Filesystem  1B-blocks       Used  Available Use% Mounted on
    const line = '/dev/sda1   100000000000 40000000000 60000000000  40% /'
    const result = parseDiskLine(line)
    expect(result).not.toBeNull()
    expect(result!.total).toBe(100000000000)
    expect(result!.used).toBe(40000000000)
    expect(result!.percent).toBe(40)
  })

  it('returns null for invalid lines', () => {
    expect(parseDiskLine('')).toBeNull()
    expect(parseDiskLine('single')).toBeNull()
    expect(parseDiskLine('a b c')).toBeNull()
  })

  it('returns null when total is zero', () => {
    expect(parseDiskLine('dev 0 0 0')).toBeNull()
  })

  it('handles dfs with more columns (snap packages)', () => {
    const line = '/dev/sda1 50000000000 20000000000 30000000000  40% /snap/foo/123'
    const result = parseDiskLine(line)
    expect(result).not.toBeNull()
    expect(result!.total).toBe(50000000000)
    expect(result!.used).toBe(20000000000)
  })
})

describe('parseNetDev', () => {
  it('parses /proc/net/dev excluding loopback', () => {
    const text = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1000000     100    0    0    0     0          0         0  1000000     100    0    0    0     0       0          0
  eth0: 5000000     200    0    0    0     0          0         0  3000000     150    0    0    0     0       0          0
  eth1: 2000000     100    0    0    0     0          0         0  1000000      50    0    0    0     0       0          0`
    const result = parseNetDev(text)
    expect(result.rx).toBe(5000000 + 2000000) // eth0 + eth1, lo excluded
    expect(result.tx).toBe(3000000 + 1000000)
  })

  it('returns zeros for empty input', () => {
    const result = parseNetDev('')
    expect(result.rx).toBe(0)
    expect(result.tx).toBe(0)
  })

  it('skips lines without proper interface format', () => {
    const text = `Inter-|   Receive
 face |bytes
    lo: 100 1 0 0 0 0 0 0 100 1 0 0 0 0 0 0`
    // lo excluded, nothing else → 0
    const result = parseNetDev(text)
    expect(result.rx).toBe(0)
    expect(result.tx).toBe(0)
  })
})
