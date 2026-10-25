import type { Tile as GameTile } from '../engine'
import { Tile } from './Tile'

export interface DragLayerProps {
  tile: GameTile | null
  letter?: string
  x: number
  y: number
  visible: boolean
}

export function DragLayer({ tile, letter, x, y, visible }: DragLayerProps) {
  if (!visible || !tile) return null
  return (
    <div className="wr-drag-layer" style={{ left: x, top: y }} aria-hidden="true">
      <Tile tile={tile} letter={letter} state="dragging" />
    </div>
  )
}
