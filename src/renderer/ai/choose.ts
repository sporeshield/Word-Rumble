import { EXCHANGE_MIN_BAG, type GameAction, type GameState } from '../engine'
import type { Difficulty } from '../screens/types'
import type { Move } from './movegen'

/** Share of the best-first list each level picks from: [from, to) as fractions. */
const BANDS: Record<Difficulty, [number, number]> = {
  easy: [0.6, 1],
  medium: [0.2, 0.5],
  hard: [0, 0]
}

/** Pick a move from a best-first list; hard always takes the top one. */
export function chooseMove(moves: Move[], difficulty: Difficulty, rng: () => number = Math.random): Move | null {
  if (moves.length === 0) return null
  const [from, to] = BANDS[difficulty]
  if (difficulty === 'hard') return moves[0]
  const lo = Math.min(moves.length - 1, Math.floor(moves.length * from))
  const hi = Math.max(lo + 1, Math.ceil(moves.length * to))
  return moves[lo + Math.floor(rng() * (hi - lo))]
}

/** The computer's action for its turn: a play, else swap everything, else pass. Never made-up words or hints. */
export function computerAction(state: GameState, moves: Move[], difficulty: Difficulty, rng?: () => number): GameAction {
  const move = chooseMove(moves, difficulty, rng)
  if (move) return { type: 'play', placements: move.placements }
  const rack = state.players[state.current].rack
  if (state.bag.length >= EXCHANGE_MIN_BAG && rack.length > 0) return { type: 'exchange', tileIds: rack.map((t) => t.id) }
  return { type: 'pass' }
}
