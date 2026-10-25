import { BOARD_SIZE, CENTER, type Board, type Premium } from './types'

/** Premium lookup keyed by (a,b) = (min,max) of the distances from the centre; see PLAN Appendix A. */
const PREMIUM_BY_AB: Record<string, Premium> = {}
const register = (premium: Premium, pairs: [number, number][]): void => {
  for (const [a, b] of pairs) PREMIUM_BY_AB[`${a},${b}`] = premium
}
register('START', [[0, 0]])
register('TW', [[4, 7]])
register('DW', [[0, 6], [4, 4], [2, 5]])
register('TL', [[0, 4], [6, 6], [1, 6]])
register('DL', [[0, 2], [2, 2], [7, 7], [1, 3], [0, 7]])

export function premiumAt(row: number, col: number): Premium {
  const dr = Math.abs(row - CENTER)
  const dc = Math.abs(col - CENTER)
  return PREMIUM_BY_AB[`${Math.min(dr, dc)},${Math.max(dr, dc)}`] ?? 'NONE'
}

/** The full 15x15 premium layout, built once. */
export const PREMIUM_LAYOUT: Premium[][] = Array.from({ length: BOARD_SIZE }, (_, r) =>
  Array.from({ length: BOARD_SIZE }, (_, c) => premiumAt(r, c))
)

export const createBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null))

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE

export const isBoardEmpty = (board: Board): boolean => board.every((row) => row.every((c) => c === null))
