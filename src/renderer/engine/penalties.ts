import { randomInt } from './bag'

export type PenaltyOutcome =
  | 'half' | 'zero' | 'minus10' | 'gift' | 'skip' | 'rackwipe' | 'convince' | 'lucky'
  | 'minus20'

/** The 8 wheel slices in wheel order. Solo swaps the opponent-based slices for −20 / Zero. */
export const PENALTY_SLICES: readonly PenaltyOutcome[] = ['half', 'zero', 'minus10', 'gift', 'skip', 'rackwipe', 'convince', 'lucky']
export const SOLO_PENALTY_SLICES: readonly PenaltyOutcome[] = ['half', 'zero', 'minus10', 'minus20', 'skip', 'rackwipe', 'zero', 'lucky']

export const penaltySlices = (solo: boolean): readonly PenaltyOutcome[] => (solo ? SOLO_PENALTY_SLICES : PENALTY_SLICES)

/** Lucky escape is rare: it lands a third as often as any other slice. */
const LUCKY_WEIGHT = 1
const NORMAL_WEIGHT = 3

/** Spin the wheel with crypto randomness. Returns the landing slice index and its outcome. */
export function spinPenalty(solo: boolean): { index: number; outcome: PenaltyOutcome } {
  const slices = penaltySlices(solo)
  const weights = slices.map((s) => (s === 'lucky' ? LUCKY_WEIGHT : NORMAL_WEIGHT))
  let roll = randomInt(weights.reduce((a, b) => a + b, 0))
  for (let index = 0; index < slices.length; index++) {
    if (roll < weights[index]) return { index, outcome: slices[index] }
    roll -= weights[index]
  }
  return { index: 0, outcome: slices[0] }
}

export const HINT_COST_MIN = 5
export const HINT_COST_MAX = 30

/** Random hint price (5–30 points) for "with penalty" hints. */
export const rollHintCost = (): number => HINT_COST_MIN + randomInt(HINT_COST_MAX - HINT_COST_MIN + 1)
