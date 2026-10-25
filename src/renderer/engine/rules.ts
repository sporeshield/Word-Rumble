import { inBounds } from './board'
import { CENTER, type Board, type FormedWord, type Placement, type PlacementResult } from './types'

const isLetter = (s: string): boolean => /^[A-Z]$/.test(s)

type Pending = Map<string, Placement>

/** Letter at (row,col): from the pending placements, else the board. */
function letterAt(board: Board, pending: Pending, row: number, col: number): string | null {
  if (!inBounds(row, col)) return null
  const p = pending.get(`${row},${col}`)
  if (p) return p.letter
  return board[row][col]?.letter ?? null
}

/** The word running through (row,col) along an axis; null if shorter than 2 letters. */
function wordAlong(board: Board, pending: Pending, row: number, col: number, horizontal: boolean): FormedWord | null {
  const dr = horizontal ? 0 : 1
  const dc = horizontal ? 1 : 0
  let r = row
  let c = col
  while (letterAt(board, pending, r - dr, c - dc) !== null) {
    r -= dr
    c -= dc
  }
  const squares: FormedWord['squares'] = []
  let text = ''
  while (letterAt(board, pending, r, c) !== null) {
    text += letterAt(board, pending, r, c)
    squares.push({ row: r, col: c, isNew: pending.has(`${r},${c}`) })
    r += dr
    c += dc
  }
  return squares.length >= 2 ? { text, squares } : null
}

/**
 * Check pending placements against the board and return every word formed (main word first).
 * Geometry and connection rules only; the dictionary is checked elsewhere.
 */
export function validatePlacement(board: Board, placements: Placement[]): PlacementResult {
  if (placements.length === 0) return { ok: false, error: 'no-tiles' }

  const pending: Pending = new Map()
  const tileIds = new Set<number>()
  for (const p of placements) {
    if (!Number.isInteger(p.row) || !Number.isInteger(p.col) || !inBounds(p.row, p.col)) {
      return { ok: false, error: 'out-of-bounds' }
    }
    if (board[p.row][p.col]) return { ok: false, error: 'occupied' }
    if (!isLetter(p.letter)) return { ok: false, error: 'blank-letter-missing' }
    if (p.tile.letter !== '?' && p.tile.letter !== p.letter) return { ok: false, error: 'tile-mismatch' }
    if (tileIds.has(p.tile.id)) return { ok: false, error: 'duplicate-tile' }
    tileIds.add(p.tile.id)
    const key = `${p.row},${p.col}`
    if (pending.has(key)) return { ok: false, error: 'duplicate-square' }
    pending.set(key, p)
  }

  const rows = new Set(placements.map((p) => p.row))
  const cols = new Set(placements.map((p) => p.col))
  if (rows.size > 1 && cols.size > 1) return { ok: false, error: 'not-in-line' }
  const horizontal = rows.size === 1

  // Contiguity: every square between the first and last placement must be filled.
  if (placements.length > 1) {
    const fixed = horizontal ? placements[0].row : placements[0].col
    const idx = placements.map((p) => (horizontal ? p.col : p.row))
    for (let i = Math.min(...idx); i <= Math.max(...idx); i++) {
      const r = horizontal ? fixed : i
      const c = horizontal ? i : fixed
      if (letterAt(board, pending, r, c) === null) return { ok: false, error: 'gap' }
    }
  }

  const boardEmpty = board.every((row) => row.every((cell) => cell === null))
  if (boardEmpty) {
    if (!pending.has(`${CENTER},${CENTER}`)) return { ok: false, error: 'first-move-center' }
    if (placements.length < 2) return { ok: false, error: 'first-move-too-short' }
  } else {
    const touches = placements.some((p) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
        const r = p.row + dr
        const c = p.col + dc
        return inBounds(r, c) && board[r][c] !== null
      })
    )
    if (!touches) return { ok: false, error: 'not-connected' }
  }

  const words: FormedWord[] = []
  const first = placements[0]
  // A lone tile has no real "direction": try both axes, horizontal first.
  const main = wordAlong(board, pending, first.row, first.col, horizontal)
  if (main) words.push(main)
  if (placements.length === 1) {
    const other = wordAlong(board, pending, first.row, first.col, !horizontal)
    if (other) words.push(other)
  } else {
    for (const p of placements) {
      const cross = wordAlong(board, pending, p.row, p.col, !horizontal)
      if (cross) words.push(cross)
    }
  }
  if (words.length === 0) return { ok: false, error: 'not-connected' }

  return { ok: true, words }
}
