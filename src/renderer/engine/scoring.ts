import { PREMIUM_LAYOUT } from './board'
import {
  RACK_SIZE, RUMBLE_BONUS, isBlank,
  type Board, type FormedWord, type Placement, type PlayScore, type Premium
} from './types'

/** Score one word. Only new tiles trigger premiums; blanks score 0 but still trigger word premiums. */
function scoreWord(
  word: FormedWord, board: Board, pending: Map<string, Placement>, hit: Premium[], seen: Set<string>, layout: Premium[][]
): number {
  let sum = 0
  let multiplier = 1
  for (const sq of word.squares) {
    const placed = pending.get(`${sq.row},${sq.col}`)
    const tile = placed ? placed.tile : board[sq.row][sq.col]!.tile
    let value = isBlank(tile) ? 0 : tile.points
    if (sq.isNew) {
      const premium = layout[sq.row][sq.col]
      if (premium === 'DL') value *= 2
      else if (premium === 'TL') value *= 3
      else if (premium === 'PL5') value *= 5
      else if (premium === 'PL10') value *= 10
      else if (premium === 'DW' || premium === 'START') multiplier *= 2
      else if (premium === 'TW') multiplier *= 3
      else if (premium === 'QW') multiplier *= 4
      else if (premium === 'PW5') multiplier *= 5
      else if (premium === 'PW10') multiplier *= 10
      const key = `${sq.row},${sq.col}`
      if (premium !== 'NONE' && !seen.has(key)) {
        seen.add(key)
        hit.push(premium)
      }
    }
    sum += value
  }
  return sum * multiplier
}

/** Score every word of a play (letter premiums before word premiums) plus the RUMBLE! bonus for using 7 tiles. */
export function scorePlay(
  board: Board, placements: Placement[], words: FormedWord[], layout: Premium[][] = PREMIUM_LAYOUT
): PlayScore {
  const pending = new Map(placements.map((p) => [`${p.row},${p.col}`, p]))
  const premiumsHit: Premium[] = []
  const seen = new Set<string>()
  const scored = words.map((w) => ({ text: w.text, score: scoreWord(w, board, pending, premiumsHit, seen, layout) }))
  const rumble = placements.length === RACK_SIZE
  const rumbleBonus = rumble ? RUMBLE_BONUS : 0
  const total = scored.reduce((s, w) => s + w.score, 0) + rumbleBonus
  return { total, words: scored, rumble, rumbleBonus, premiumsHit }
}

/** Apply placements to a board, returning a new board. */
export function applyPlacements(board: Board, placements: Placement[]): Board {
  const next = board.map((row) => row.slice())
  for (const p of placements) next[p.row][p.col] = { tile: p.tile, letter: p.letter }
  return next
}
