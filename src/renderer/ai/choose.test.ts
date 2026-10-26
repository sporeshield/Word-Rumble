import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import { chooseMove, computerAction } from './choose'
import type { Move } from './movegen'

const moves = (n: number): Move[] =>
  Array.from({ length: n }, (_, i) => ({ placements: [], words: [], score: { total: n - i, words: [], rumble: false, rumbleBonus: 0, premiumsHit: [] } }))

describe('chooseMove', () => {
  it('returns null with no moves', () => {
    expect(chooseMove([], 'hard')).toBeNull()
  })

  it('hard takes the best move', () => {
    expect(chooseMove(moves(50), 'hard', () => 0.99)?.score.total).toBe(50)
  })

  it('medium stays in the middle band, easy in the lower band', () => {
    const list = moves(100)
    for (const r of [0, 0.5, 0.999]) {
      const m = chooseMove(list, 'medium', () => r)!.score.total
      expect(m).toBeLessThanOrEqual(80)
      expect(m).toBeGreaterThan(50)
      const e = chooseMove(list, 'easy', () => r)!.score.total
      expect(e).toBeLessThanOrEqual(40)
    }
  })

  it('always returns a move from a tiny list', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) expect(chooseMove(moves(1), d, () => 0.9)).not.toBeNull()
  })
})

describe('computerAction', () => {
  const game = createGame({ mode: 'computer', names: ['Tess', 'Computer'], timerSeconds: null, hints: 'off', madeUp: 'no' })

  it('plays the chosen move', () => {
    const list = moves(3)
    expect(computerAction(game, list, 'hard').type).toBe('play')
  })

  it('swaps its rack when stuck with a full bag, else passes', () => {
    expect(computerAction(game, [], 'hard').type).toBe('exchange')
    expect(computerAction({ ...game, bag: [] }, [], 'hard').type).toBe('pass')
  })
})
