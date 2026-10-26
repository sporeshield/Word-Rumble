import { memo, type ReactNode } from 'react'
import type { Premium } from '../engine'

export interface SquareProps {
  row: number
  col: number
  premium: Premium
  hovered?: boolean
  children?: ReactNode
  onPointerUp?: (row: number, col: number) => void
  onClick?: (row: number, col: number) => void
}

/** Big label on the square, plus the small tag under word squares. */
const premiumLabel: Record<Premium, { main: string; tag?: string; aria: string }> = {
  TW: { main: '×3', tag: 'WORD', aria: 'triple word' },
  DW: { main: '×2', tag: 'WORD', aria: 'double word' },
  TL: { main: '×3', aria: 'triple letter' },
  DL: { main: '×2', aria: 'double letter' },
  START: { main: '★', aria: 'start' },
  NONE: { main: '', aria: '' }
}

export const Square = memo(function Square({
  row,
  col,
  premium,
  hovered = false,
  children,
  onPointerUp,
  onClick
}: SquareProps) {
  return (
    <div
      className={`wr-square wr-square--${premium.toLowerCase()}${hovered ? ' wr-square--hovered' : ''}`}
      role="gridcell"
      data-row={row}
      data-col={col}
      aria-label={`Row ${row + 1}, column ${col + 1}${premium !== 'NONE' ? `, ${premiumLabel[premium].aria}` : ''}`}
      onPointerUp={onPointerUp ? () => onPointerUp(row, col) : undefined}
      onClick={onClick ? () => onClick(row, col) : undefined}
    >
      {premium !== 'NONE' && !children ? <span className="wr-square__label" aria-hidden="true">{premiumLabel[premium].main}{premiumLabel[premium].tag ? <small className="wr-square__tag">{premiumLabel[premium].tag}</small> : null}</span> : null}
      {children}
    </div>
  )
})
