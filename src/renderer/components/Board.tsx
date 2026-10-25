import { useMemo, type PointerEvent, type ReactNode } from 'react'
import { BOARD_SIZE, PREMIUM_LAYOUT, type Board as GameBoard, type Placement } from '../engine'
import boardFrame from '@art/board-frame.webp'
import { Square } from './Square'
import { Tile } from './Tile'

export interface BoardProps {
  board: GameBoard
  pending: Placement[]
  hoverSquare?: { row: number; col: number } | null
  onSquarePointerUp?: (row: number, col: number) => void
  onSquareClick?: (row: number, col: number) => void
  onPendingPointerDown?: (placement: Placement, event: PointerEvent<HTMLDivElement>) => void
  onPendingClick?: (placement: Placement) => void
  playedBy?: (row: number, col: number) => string | undefined
  children?: ReactNode
}

export function Board({
  board,
  pending,
  hoverSquare,
  onSquarePointerUp,
  onSquareClick,
  onPendingPointerDown,
  onPendingClick,
  playedBy,
  children
}: BoardProps) {
  const pendingBySquare = useMemo(() => new Map(pending.map((placement) => [
    placement.row * BOARD_SIZE + placement.col,
    placement
  ])), [pending])

  return (
    <div className="wr-board" style={{ backgroundImage: `url('${boardFrame}')` }} role="grid" aria-label="Word Rumble board">
      <div className="wr-board__grid">
        {PREMIUM_LAYOUT.map((premiumRow, row) => premiumRow.map((premium, col) => {
          const cell = board[row]?.[col]
          const placement = pendingBySquare.get(row * BOARD_SIZE + col)
          return (
            <Square
              key={`${row}-${col}`}
              row={row}
              col={col}
              premium={premium}
              hovered={hoverSquare?.row === row && hoverSquare.col === col}
              onPointerUp={onSquarePointerUp}
              onClick={onSquareClick}
            >
              {placement ? (
                <Tile
                  tile={placement.tile}
                  letter={placement.letter}
                  state="pending"
                  onPointerDown={onPendingPointerDown ? (event) => onPendingPointerDown(placement, event) : undefined}
                  onClick={onPendingClick ? () => onPendingClick(placement) : undefined}
                />
              ) : cell ? (
                <Tile tile={cell.tile} letter={cell.letter} state="board" ownerColor={playedBy?.(row, col)} />
              ) : null}
            </Square>
          )
        }))}
      </div>
      {children ? <div className="wr-board__overlay">{children}</div> : null}
    </div>
  )
}
