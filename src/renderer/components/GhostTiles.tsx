import { useEffect, type CSSProperties } from 'react'
import { sfx } from '../audio/sfx'
import type { Placement } from '../engine'
import { Tile } from './Tile'

export interface GhostTilesProps {
  placements: Placement[]
}

export function GhostTiles({ placements }: GhostTilesProps) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers = placements.map((_, index) => window.setTimeout(
      () => sfx.play('hint-ghost'), reduced ? 0 : index * 180
    ))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [placements])

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
