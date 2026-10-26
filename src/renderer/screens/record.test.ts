import { describe, expect, it } from 'vitest'
import { createGame, reduce, type GameState, type Tile } from '../engine'
import { buildGameRecord, newHighScores, placeNumbers } from './record'
import { DEFAULT_SETUP } from './types'

let id = 9000
const tile = (letter: string): Tile => ({ id: id++, letter, points: 1 })

function twoPlayerGame(): GameState {
  const g = createGame({ mode: 'two', names: ['Shane', 'Dawn'], timerSeconds: null, hints: 'off', madeUp: 'no' })
  return { ...g, current: 0, players: g.players.map((p) => ({ ...p, rack: 'CATSERD'.split('').map(tile) })) }
}

function played(): GameState {
  const g = twoPlayerGame()
  const rack = [...g.players[0].rack]
  const placements = [...'CAT'].map((letter, i) => ({ row: 7, col: 7 + i, tile: rack.splice(rack.findIndex((t) => t.letter === letter), 1)[0], letter }))
  const r = reduce(g, { type: 'play', placements })
  if (!r.ok) throw new Error(r.error)
  const c = reduce(r.state, { type: 'concede' })
  if (!c.ok) throw new Error(c.error)
  return c.state
}

describe('buildGameRecord', () => {
  it('maps a game where Dawn conceded two-player game', () => {
    const rec = buildGameRecord(played(), DEFAULT_SETUP, '2026-10-25T10:00:00.000Z')
    expect(rec.mode).toBe('two')
    expect(rec.endedReason).toBe('conceded')
    expect(rec.players.map((p) => p.name)).toEqual(['Shane', 'Dawn'])
    expect(rec.players[0].conceded).toBe(false)
    expect(rec.players[1].conceded).toBe(true)
    expect(rec.players[0].winner).toBe(true)
    expect(rec.plays).toHaveLength(1)
    expect(rec.plays![0].words).toEqual(['CAT'])
    expect(rec.plays![0].score).toBeGreaterThan(0)
  })

  it('records places, drop-out gifts and recipients for three players', () => {
    const g0 = createGame({ mode: 'two', names: ['Shane', 'Dawn', 'Pip'], timerSeconds: null, hints: 'off', madeUp: 'no' })
    const g: GameState = { ...g0, current: 0, players: g0.players.map((p, i) => ({ ...p, score: [30, 10, 5][i] })) }
    const a = reduce(g, { type: 'concede', recipient: 1 }) // Shane gives 30 to Dawn
    if (!a.ok) throw new Error(a.error)
    const b = reduce({ ...a.state, current: 2 }, { type: 'concede', recipient: null }) // Pip drops, gives nothing
    if (!b.ok) throw new Error(b.error)
    const rec = buildGameRecord(b.state, DEFAULT_SETUP)
    expect(rec.players.map((p) => [p.name, p.rank, p.finalScore, p.givenAway, p.giftTo, p.conceded, p.winner])).toEqual([
      ['Shane', 3, 0, 30, 'Dawn', true, false],
      ['Dawn', 1, 40, 0, null, false, true],
      ['Pip', 2, 5, 0, null, true, false]
    ])
  })

  it('numbers shared places 1, 1, 3', () => {
    expect(placeNumbers([[2, 0], [1], [3]], 4)).toEqual([1, 3, 1, 4])
  })

  it('refuses a game still in play', () => {
    expect(() => buildGameRecord(twoPlayerGame(), DEFAULT_SETUP)).toThrow()
  })

  it('flags the computer seat', () => {
    const g = createGame({ mode: 'computer', names: ['Shane', 'Computer'], timerSeconds: null, hints: 'off', madeUp: 'no' })
    const done = reduce(g, { type: 'concede' })
    if (!done.ok) throw new Error(done.error)
    const rec = buildGameRecord(done.state, { ...DEFAULT_SETUP, difficulty: 'hard' })
    expect(rec.difficulty).toBe('hard')
    expect(rec.players[1].isComputer).toBe(true)
  })
})

describe('newHighScores', () => {
  const finished = (scores: number[], conceder: number | null = null): GameState => {
    const g = played()
    const players = g.players.map((p, i) => ({ ...p, conceded: conceder === i }))
    return { ...g, players, result: { ...g.result!, finalScores: scores, conceder } }
  }

  it('stamps any positive score while the table has room', () => {
    expect(newHighScores(finished([30, 5]), [{ score: 99 }])).toEqual([true, true])
  })

  it('needs to beat the 10th best once the table is full', () => {
    const top = Array.from({ length: 10 }, (_, i) => ({ score: 200 - i * 10 })) // 200 … 110
    expect(newHighScores(finished([111, 110]), top)).toEqual([true, false])
  })

  it('never stamps zero or the player who conceded', () => {
    expect(newHighScores(finished([0, 20], 1), [])).toEqual([false, false])
  })
})
