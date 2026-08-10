import React, { useState } from 'react'
import { Rect, SplitDirection } from '../splits'

interface Props {
  direction: SplitDirection
  barRect: Rect
  nodeRect: Rect
  onUpdate: (ratio: number) => void
}

export default function SplitHandle({ direction, barRect, nodeRect, onUpdate }: Props): JSX.Element {
  const isVertical = direction === 'vertical'
  const [dragging, setDragging] = useState(false)

  const style: React.CSSProperties = {
    position: 'absolute',
    left: barRect.x,
    top: barRect.y,
    width: barRect.w,
    height: barRect.h
  }

  function handleMouseDown(e: React.MouseEvent): void {
    e.preventDefault()
    setDragging(true)

    function onMouseMove(ev: MouseEvent): void {
      const total = isVertical ? nodeRect.w : nodeRect.h
      const pos = isVertical ? ev.clientX - nodeRect.x : ev.clientY - nodeRect.y
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
