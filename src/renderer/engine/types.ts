export const BOARD_SIZE = 15
export const CENTER = 7
export const RACK_SIZE = 7
export const RUMBLE_BONUS = 50
export const EXCHANGE_MIN_BAG = 7

/** A physical tile. `letter` is '?' for a blank; `points` is 0 for a blank. */
export interface Tile {
  id: number
  letter: string
  points: number
}

export const isBlank = (tile: Tile): boolean => tile.letter === '?'

export type Premium = 'START' | 'TW' | 'DW' | 'TL' | 'DL' | 'NONE'

/** A tile fixed on the board; `letter` is the effective A-Z (the chosen one for a blank). */
export interface BoardCell {
  tile: Tile
  letter: string
}

export type Board = (BoardCell | null)[][]

/** A tile the current player is laying this turn. `letter` must be A-Z (chosen letter for a blank). */
export interface Placement {
  row: number
  col: number
  tile: Tile
  letter: string
}

export interface FormedWord {
  text: string
  squares: { row: number; col: number; isNew: boolean }[]
}

export type PlacementError =
  | 'no-tiles'
  | 'out-of-bounds'
  | 'occupied'
  | 'duplicate-square'
  | 'blank-letter-missing'
  | 'tile-mismatch'
  | 'duplicate-tile'
  | 'not-in-line'
  | 'gap'
  | 'first-move-center'
  | 'first-move-too-short'
  | 'not-connected'

export type PlacementResult =
  | { ok: true; words: FormedWord[] }
  | { ok: false; error: PlacementError }

export interface WordScore {
  text: string
  score: number
}

export interface PlayScore {
  total: number
  words: WordScore[]
  rumble: boolean
  rumbleBonus: number
  /** Premium kinds triggered by newly placed tiles (drives comic bursts). */
  premiumsHit: Premium[]
}
