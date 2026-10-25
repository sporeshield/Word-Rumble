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

const premiumLabel: Record<Premium, string> = {
  TW: '3W',
  DW: '2W',
  TL: '3L',
  DL: '2L',
  START: '★',
  NONE: ''
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
      aria-label={`Row ${row + 1}, column ${col + 1}${premium !== 'NONE' ? `, ${premiumLabel[premium] === '★' ? 'start' : premiumLabel[premium]}` : ''}`}
      onPointerUp={onPointerUp ? () => onPointerUp(row, col) : undefined}
      onClick={onClick ? () => onClick(row, col) : undefined}
    >
      {premium !== 'NONE' && !children ? <span className="wr-square__label" aria-hidden="true">{premiumLabel[premium]}</span> : null}
      {children}
    </div>
  )
})
