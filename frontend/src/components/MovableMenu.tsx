import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'

type Position = { x: number; y: number }

export function MovableMenu({ overlay, children }: { overlay: boolean; children: ReactNode }) {
  const menuRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [dragging, setDragging] = useState(false)

  const constrain = (point: Position): Position => {
    const rect = menuRef.current?.getBoundingClientRect()
    return {
      x: Math.max(8, Math.min(point.x, window.innerWidth - (rect?.width ?? 0) - 8)),
      y: Math.max(8, Math.min(point.y, window.innerHeight - (rect?.height ?? 0) - 8)),
    }
  }

  // Keep the handle reachable after resizing or when menu content grows.
  useEffect(() => {
    if (!overlay || !menuRef.current) return
    const fit = () => setPosition(current => {
      if (!current) return current
      const next = constrain(current)
      return next.x === current.x && next.y === current.y ? current : next
    })
    const observer = new ResizeObserver(fit)
    observer.observe(menuRef.current)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [overlay])

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    const rect = menuRef.current!.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPosition(constrain({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY }))
  }

  const stopDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') {
      event.preventDefault()
      setPosition(null)
      return
    }
    const directions: Record<string, Position> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const rect = menuRef.current!.getBoundingClientRect()
    const step = event.shiftKey ? 48 : 16
    setPosition(constrain({ x: rect.left + direction.x * step, y: rect.top + direction.y * step }))
  }

  return (
    <div
      ref={menuRef}
      className={`app-menu${overlay ? ' app-menu-overlay' : ''}${dragging ? ' menu-dragging' : ''}`}
      style={overlay && position ? { left: position.x, top: position.y, right: 'auto', marginInline: 0, width: 'min(640px, calc(100% - 16px))' } : undefined}
    >
      {overlay && (
        <button
          type="button"
          className="menu-drag-handle"
          aria-label="Move menu"
          title="Drag to move. Use arrow keys when focused; Home resets the position."
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={stopDrag}
          onKeyDown={moveWithKeyboard}
        >
          <span aria-hidden="true">⠿</span> Move menu
        </button>
      )}
      {children}
    </div>
  )
}
