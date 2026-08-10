import React, { useState } from 'react'
import { SplitPair } from '../types'

interface Props {
  split: SplitPair
  onUpdate: (ratio: number) => void
}

export default function SplitHandle({ split, onUpdate }: Props): JSX.Element {
  const { direction, ratio } = split
  const isVertical = direction === 'vertical'
  const [dragging, setDragging] = useState(false)

  const style: React.CSSProperties = isVertical
    ? { position: 'absolute', top: 0, bottom: 0, left: `calc(${ratio * 100}% - 2px)`, width: 4 }
    : { position: 'absolute', left: 0, right: 0, top: `calc(${ratio * 100}% - 2px)`, height: 4 }

  function handleMouseDown(e: React.MouseEvent): void {
    e.preventDefault()
    setDragging(true)
    const container = (e.currentTarget as HTMLElement).parentElement
    if (!container) return
    const rect = container.getBoundingClientRect()

    function onMouseMove(ev: MouseEvent): void {
      const total = isVertical ? rect.width : rect.height
      const pos = isVertical ? ev.clientX - rect.left : ev.clientY - rect.top
      onUpdate(Math.max(0.15, Math.min(0.85, pos / total)))
    }

    function onMouseUp(): void {
      setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      className={`split-handle split-handle-${direction}${dragging ? ' active' : ''}`}
      style={style}
      onMouseDown={handleMouseDown}
    />
  )
}
