import { type CSSProperties, type PointerEvent } from 'react'
import type { Tile as GameTile } from '../engine'
import { Tile } from './Tile'

export interface RackProps {
  owner: string
  color: string
  tiles: GameTile[] | null
  count: number
  faceDown: boolean
  selectedId?: number
  onTilePointerDown?: (tile: GameTile, event: PointerEvent<HTMLDivElement>) => void
  onTileClick?: (tile: GameTile) => void
  onReorder?: (from: number, to: number) => void
}

export function Rack({
  owner,
  color,
  tiles,
  count,
  faceDown,
  selectedId,
  onTilePointerDown,
  onTileClick,
  onReorder
}: RackProps) {
  // Keep the hidden branch entirely separate so even a supplied tiles array is never inspected.
  const visibleTiles = faceDown ? null : tiles
  const slotCount = Math.max(7, faceDown ? count : (visibleTiles?.length ?? count))
  const style = {
    '--player': color,
    '--rack-slots': slotCount
  } as CSSProperties

  return (
    <section className="wr-rack" style={style} aria-label={`${owner}'s rack`}>
      <div className="wr-rack__name">{owner}</div>
      <div className="wr-rack__holder">
        <div className="wr-rack__slots">
          {Array.from({ length: slotCount }, (_, index) => {
            const tile = faceDown ? null : visibleTiles?.[index]
            const hasBack = faceDown && index < count
            return (
              <div
                className="wr-rack__slot"
                data-rack-slot={index}
                key={index}
                tabIndex={tile && (onReorder || onTileClick) ? 0 : undefined}
                role={tile && (onReorder || onTileClick) ? 'button' : undefined}
                aria-label={tile && (onReorder || onTileClick) ? `Tile ${index + 1}${onReorder ? ', use arrow keys to move' : ''}` : undefined}
                onKeyDown={tile && (onReorder || onTileClick) ? (event) => {
                  if (event.key === 'ArrowLeft' && index > 0 && onReorder) { event.preventDefault(); onReorder(index, index - 1) }
                  if (event.key === 'ArrowRight' && index < slotCount - 1 && onReorder) { event.preventDefault(); onReorder(index, index + 1) }
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onTileClick?.(tile) }
                } : undefined}
              >
                {hasBack ? (
                  <div className="wr-rack__flip" key="back">
                    <Tile tile={{ id: index, letter: '?', points: 0 }} faceDown />
                  </div>
                ) : tile ? (
                  <div className="wr-rack__flip" key={`front-${tile.id}`}>
                    <Tile
                      tile={tile}
                      state={selectedId === tile.id ? 'selected' : 'rack'}
                      onPointerDown={onTilePointerDown ? (event) => onTilePointerDown(tile, event) : undefined}
                      onClick={onTileClick ? () => onTileClick(tile) : undefined}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
