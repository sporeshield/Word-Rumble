import { shuffle } from './bag'
import { validatePlacement } from './rules'
import { scorePlay } from './scoring'
import type { Board, FormedWord, Placement, PlacementError, PlayScore, Premium, Tile } from './types'

export type PlayPreview =
  | { kind: 'empty' }
  | { kind: 'invalid'; error: PlacementError }
  | { kind: 'ok'; words: FormedWord[]; score: PlayScore }

/** Live preview of the tiles laid so far this turn: legal shape + score, or why it is not legal yet. */
export function previewPlay(board: Board, pending: Placement[], layout?: Premium[][]): PlayPreview {
  if (pending.length === 0) return { kind: 'empty' }
  const placed = validatePlacement(board, pending)
  if (!placed.ok) return { kind: 'invalid', error: placed.error }
  return { kind: 'ok', words: placed.words, score: scorePlay(board, pending, placed.words, layout) }
}

/** Short plain-English hint for a placement error, shown under the board while a play is being built. */
export const PLACEMENT_HINTS: Record<PlacementError, string> = {
  'no-tiles': 'Drag tiles onto the board.',
  'out-of-bounds': 'That tile is off the board.',
  occupied: 'That square is already taken.',
  'duplicate-square': 'Two tiles on one square.',
  'blank-letter-missing': 'Pick a letter for the blank.',
  'tile-mismatch': 'Something is off with a tile.',
  'duplicate-tile': 'That tile is used twice.',
  'not-in-line': 'Tiles must sit in one row or one column.',
  gap: 'No gaps allowed between your tiles.',
  'first-move-center': 'The first word must cover the star.',
  'first-move-too-short': 'The first word needs at least 2 letters.',
  'not-connected': 'Your word must touch tiles already on the board.'
}

/** Rack tiles in the player's own order: known ids keep their position, new tiles join at the end. */
export function orderRack(order: readonly number[], rack: readonly Tile[]): Tile[] {
  const byId = new Map(rack.map((t) => [t.id, t]))
  const out: Tile[] = []
  for (const id of order) {
    const tile = byId.get(id)
    if (tile) { out.push(tile); byId.delete(id) }
  }
  return [...out, ...byId.values()]
}

/** Move the item at `from` so it ends up at index `to` (clamped), like the Rack's drop targets and arrow keys. */
export function moveInList<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items]
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved)
  return next
}

export const shuffleIds = (tiles: readonly Tile[]): number[] => shuffle(tiles).map((t) => t.id)

/** Lower-case distinct words of a preview, for the dictionary check. */
export const wordsToCheck = (words: readonly FormedWord[]): string[] => [...new Set(words.map((w) => w.text.toLowerCase()))]
