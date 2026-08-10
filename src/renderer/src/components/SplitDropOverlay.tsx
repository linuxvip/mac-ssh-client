import React from 'react'

export type SplitDropZone = 'left' | 'right' | 'top' | 'bottom'

interface Props {
  zone: SplitDropZone | null
}

const ZONES: { id: SplitDropZone; label: string; icon: string }[] = [
  { id: 'left', label: '左右分屏', icon: '◀' },
  { id: 'right', label: '左右分屏', icon: '▶' },
  { id: 'top', label: '上下分屏', icon: '▲' },
  { id: 'bottom', label: '上下分屏', icon: '▼' }
]

export default function SplitDropOverlay({ zone }: Props): JSX.Element {
  return (
    <div className="split-overlay">
      {ZONES.map((z) => (
        <div
          key={z.id}
          className={`split-overlay-zone split-overlay-${z.id}${zone === z.id ? ' active' : ''}`}
        >
          <span className="split-overlay-label">
            <span className="split-overlay-icon">{z.icon}</span>
            {z.label}
          </span>
        </div>
      ))}
    </div>
  )
}
