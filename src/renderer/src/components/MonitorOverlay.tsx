import React, { useState, useEffect, useRef } from 'react'

interface MonitorData {
  cpu: number
  mem: { used: number; total: number; percent: number }
  disk: { used: number; total: number; percent: number }
  net: { rx: number; tx: number }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} M`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} G`
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} K/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} M/s`
}

function gaugeColor(pct: number): string {
  if (pct > 85) return '#ff4757'
  if (pct >= 60) return '#ffa502'
  return '#2ed573'
}

function gaugeGlow(pct: number): string {
  if (pct > 85) return '0 0 8px rgba(255,71,87,0.6)'
  if (pct >= 60) return '0 0 8px rgba(255,165,2,0.5)'
  return '0 0 8px rgba(46,213,115,0.5)'
}

// SVG ring gauge
function RingGauge({ percent, label, detail, size = 64 }: {
  percent: number; label: string; detail: string; size?: number
}): JSX.Element {
  const stroke = 4
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.min(percent, 100) / 100)
  const color = gaugeColor(percent)

  return (
    <div className="gauge-item">
      <svg width={size} height={size} className="gauge-ring">
        {/* track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
        />
        {/* value arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease',
            filter: `drop-shadow(${gaugeGlow(percent)})`
          }}
        />
        {/* center text */}
        <text
          x="50%" y="48%" textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="13" fontWeight="700"
          fontFamily="Menlo, Monaco, monospace"
          style={{ transition: 'fill 0.4s ease' }}
        >
          {percent.toFixed(0)}
        </text>
        <text
          x="50%" y="68%" textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.35)" fontSize="7"
        >
          %
        </text>
      </svg>
      <div className="gauge-meta">
        <span className="gauge-label">{label}</span>
        <span className="gauge-detail">{detail}</span>
      </div>
    </div>
  )
}

interface Props {
  sessionId: string
  host?: string
}

export default function MonitorOverlay({ sessionId, host }: Props): JSX.Element {
  const [data, setData] = useState<MonitorData | null>(null)
  const [collapsed, setCollapsed] = useState(true)
  const unsubRef = useRef<(() => void) | null>(null)

  const activeHost = host || sessionId

  useEffect(() => {
    window.api.monitor.start(sessionId)

    const unsub = window.api.monitor.onData((sid: string, d: MonitorData) => {
      if (sid === sessionId) setData(d)
    })
    unsubRef.current = unsub

    return () => {
      unsub()
      window.api.monitor.stop(sessionId)
    }
  }, [sessionId])

  return (
    <div className="monitor-panel">
      <div className="monitor-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="monitor-title">
          <span className="monitor-pulse" />
          {collapsed ? '展开监控' : '折叠监控'}
        </span>
        <span className="monitor-toggle">{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <div className="monitor-body">
          {!data ? (
            <div className="monitor-loading">
              <span className="monitor-spinner" />
            </div>
          ) : (
            <>
              <div className="monitor-session-host">{activeHost}</div>
              <div className="gauge-row">
                <RingGauge percent={data.cpu} label="CPU" detail={`${data.cpu.toFixed(1)}%`} />
                <RingGauge percent={data.mem.percent} label="MEM" detail={`${formatBytes(data.mem.used)}/${formatBytes(data.mem.total)}`} />
                <RingGauge percent={data.disk.percent} label="DISK" detail={`${formatBytes(data.disk.used)}/${formatBytes(data.disk.total)}`} />
              </div>
              <div className="net-row">
                <div className="net-item">
                  <span className="net-arrow down">&#9660;</span>
                  <span className="net-speed">{formatSpeed(data.net.rx)}</span>
                </div>
                <div className="net-item">
                  <span className="net-arrow up">&#9650;</span>
                  <span className="net-speed">{formatSpeed(data.net.tx)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
