import type { CSSProperties } from 'react'
import type { Placement } from '../engine'
import { Tile } from './Tile'

export interface GhostTilesProps {
  placements: Placement[]
}

export function GhostTiles({ placements }: GhostTilesProps) {
  return (
    <div className="wr-ghosts" aria-hidden="true">
      {placements.map((placement, index) => (
        <div
          className="wr-ghosts__item"
          key={`${placement.row}-${placement.col}-${placement.tile.id}`}
          style={{ gridRow: placement.row + 1, gridColumn: placement.col + 1, '--ghost-delay': `${index * 180}ms` } as CSSProperties}
        >
          <Tile tile={placement.tile} letter={placement.letter} state="pending" />
        </div>
      ))}
    </div>
  )
}
