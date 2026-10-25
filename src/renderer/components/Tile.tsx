import type { CSSProperties, MouseEventHandler, PointerEventHandler } from 'react'
import type { Tile as GameTile } from '../engine'

export type TileState = 'rack' | 'board' | 'pending' | 'dragging' | 'selected'

export interface TileProps {
  tile: GameTile
  letter?: string
  faceDown?: boolean
  state?: TileState
  ownerColor?: string
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  onClick?: MouseEventHandler<HTMLDivElement>
}

export function Tile({
  tile,
  letter,
  faceDown = false,
  state = 'rack',
  ownerColor,
  onPointerDown,
  onPointerUp,
  onClick
}: TileProps) {
  const isBlank = tile.letter === '?'
  const shownLetter = isBlank ? letter : tile.letter
  const style = ownerColor && !faceDown ? { '--tile-owner': ownerColor } as CSSProperties : undefined

  return (
    <div
      className={`wr-tile wr-tile--${state}${faceDown ? ' wr-tile--back' : ''}${ownerColor && !faceDown ? ' wr-tile--owned' : ''}`}
      style={style}
      role="img"
      aria-label={faceDown ? 'Face-down tile' : isBlank ? `Blank tile${shownLetter ? `, ${shownLetter}` : ''}` : `${shownLetter}, ${tile.points} points`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={onClick}
    >
      {!faceDown && shownLetter && shownLetter !== '?' ? (
        <span className={`wr-tile__letter${isBlank ? ' wr-tile__letter--blank' : ''}`} aria-hidden="true">
          {shownLetter}
        </span>
      ) : null}
      {!faceDown && !isBlank ? <span className="wr-tile__points" aria-hidden="true">{tile.points}</span> : null}
      {ownerColor && !faceDown ? <span className="wr-tile__owner" aria-hidden="true" /> : null}
    </div>
  )
}
