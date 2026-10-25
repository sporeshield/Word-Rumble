import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Tile } from '../engine'

export type TileDragSource =
  | { kind: 'rack'; index: number }
  | { kind: 'pending'; row: number; col: number }

export type TileDropTarget =
  | { kind: 'square'; row: number; col: number }
  | { kind: 'rack'; index: number }
  | { kind: 'none' }

export interface TileDragState {
  dragging: boolean
  x: number
  y: number
  hoverSquare: { row: number; col: number } | null
  tile: Tile | null
  wasDragged: boolean
  startDrag: (tile: Tile, source: TileDragSource, event: PointerEvent<HTMLElement>) => void
}

function targetAt(x: number, y: number): TileDropTarget {
  for (const element of document.elementsFromPoint(x, y)) {
    const square = element.closest<HTMLElement>('[data-row][data-col]')
    if (square) {
      const row = Number(square.dataset.row)
      const col = Number(square.dataset.col)
      if (Number.isInteger(row) && Number.isInteger(col)) return { kind: 'square', row, col }
    }
    const slot = element.closest<HTMLElement>('[data-rack-slot]')
    if (slot) {
      const index = Number(slot.dataset.rackSlot)
      if (Number.isInteger(index)) return { kind: 'rack', index }
    }
  }
  return { kind: 'none' }
}

export function useTileDrag(onDrop: (item: { tile: Tile; source: TileDragSource }, target: TileDropTarget) => void): TileDragState {
  const [state, setState] = useState({ dragging: false, x: 0, y: 0, hoverSquare: null as { row: number; col: number } | null, tile: null as Tile | null, wasDragged: false })
  const active = useRef<{ tile: Tile; source: TileDragSource; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const current = active.current
      if (!current || event.pointerId !== current.pointerId) return
      const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY)
      if (!current.moved && distance < 4) return
      current.moved = true
      const target = targetAt(event.clientX, event.clientY)
      setState({
        dragging: true,
        x: event.clientX,
        y: event.clientY,
        tile: current.tile,
        hoverSquare: target.kind === 'square' ? { row: target.row, col: target.col } : null,
        wasDragged: false
      })
    }
    const end = (event: globalThis.PointerEvent) => {
      const current = active.current
      if (!current || event.pointerId !== current.pointerId) return
      active.current = null
      if (current.moved) onDropRef.current({ tile: current.tile, source: current.source }, targetAt(event.clientX, event.clientY))
      setState((previous) => ({ ...previous, dragging: false, tile: null, hoverSquare: null, wasDragged: current.moved }))
    }
    const cancel = (event: globalThis.PointerEvent) => {
      if (active.current?.pointerId !== event.pointerId) return
      active.current = null
      setState((previous) => ({ ...previous, dragging: false, tile: null, hoverSquare: null, wasDragged: false }))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [])

  const startDrag = useCallback((tile: Tile, source: TileDragSource, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    active.current = { tile, source, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false }
    setState((previous) => ({ ...previous, x: event.clientX, y: event.clientY, wasDragged: false }))
  }, [])

  return { ...state, startDrag }
}
