import { describe, expect, it } from 'vitest'
import {
  createGame, normaliseGame, reduce, scorelessLimit,
  type GameAction, type GameOptions, type GameState, type Placement, type Tile
} from './index'

let nextId = 9000
const tile = (letter: string): Tile => ({ id: nextId++, letter, points: letter === '?' ? 0 : 1 })

const friends = (names: string[]): GameOptions =>
  ({ mode: 'two', names, timerSeconds: null, hints: 'off', madeUp: 'penalty' })
const NAMES = ['Tess', 'Blair', 'Ann', 'Bo']

function setup(count: number, racks: string[][] = []): GameState {
  const game = createGame(friends(NAMES.slice(0, count)))
  return {
    ...game, current: 0,
    players: game.players.map((p, i) => ({ ...p, rack: racks[i] ? racks[i].map(tile) : p.rack }))
  }
}

const must = (state: GameState, action: GameAction): GameState => {
  const r = reduce(state, action)
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const placeWord = (state: GameState, text: string, row = 7, col = 7): Placement[] => {
  const rack = [...state.players[state.current].rack]
  return [...text].map((letter, i) => {
    const idx = rack.findIndex((t) => t.letter === letter)
    return { row, col: col + i, tile: rack.splice(idx, 1)[0], letter }
  })
}

const CATS = ['C', 'A', 'T', 'S', 'E', 'R', 'D']
const playMade = (g: GameState, extra: Partial<Extract<GameAction, { type: 'play' }>>): ReturnType<typeof reduce> =>
  reduce(g, { type: 'play', placements: placeWord(g, 'CATS'), madeUp: true, ...extra })

describe('2–4 players', () => {
  it('accepts 2–4 friends and rejects 1 or 5', () => {
    for (const n of [2, 3, 4]) expect(createGame(friends(NAMES.slice(0, n))).players).toHaveLength(n)
    expect(() => createGame(friends(['A']))).toThrow()
    expect(() => createGame(friends(['A', 'B', 'C', 'D', 'E']))).toThrow()
    expect(() => createGame({ ...friends(['A', 'B', 'C']), mode: 'computer' })).toThrow()
  })

  it('scoreless limit is 6 / 9 / 12 and ends a 3-player game after nine passes', () => {
    expect([1, 2, 3, 4].map(scorelessLimit)).toEqual([3, 6, 9, 12])
    let g = setup(3, [CATS, CATS, CATS])
    for (let i = 0; i < 8; i++) g = must(g, { type: 'pass' })
    expect(g.phase).toBe('playing')
    g = must(g, { type: 'pass' })
    expect(g.result?.reason).toBe('scoreless')
  })

  it('turn order goes round all players and honours skips', () => {
    let g = setup(3, [CATS, CATS, CATS])
    g = must(g, { type: 'pass' })
    expect(g.current).toBe(1)
    g = { ...g, players: g.players.map((p, i) => (i === 2 ? { ...p, skipNext: true } : p)) }
    g = must(g, { type: 'pass' })
    expect(g.current).toBe(0) // Ann (2) skipped
    expect(g.history.at(-1)?.kind).toBe('skipped')
  })

  it('going out takes the leftover tiles of all the other racks', () => {
    const g = { ...setup(4, [['C', 'A', 'T'], ['Q', 'A'], ['Z'], ['E', 'E', 'E']]), bag: [] as Tile[] }
    const done = must(g, { type: 'play', placements: placeWord(g, 'CAT') })
    expect(done.result?.reason).toBe('out')
    expect(done.result?.adjustments.find((a) => a.player === 0)?.delta).toBe(6)
    expect(done.result?.finalScores).toEqual([8 + 6, -2, -1, -3])
    expect(done.result?.ranking).toEqual([[0], [2], [1], [3]])
    expect(done.result?.winner).toBe(0)
  })

  it('ties share a place; pre-adjust score breaks a final-score tie', () => {
    let g = setup(3, [CATS, CATS, CATS])
    g = { ...g, players: g.players.map((p, i) => ({ ...p, score: [50, 50, 10][i], rack: [] })) }
    g = must({ ...g, consecutiveScoreless: 8 }, { type: 'pass' })
    expect(g.result?.ranking).toEqual([[0, 1], [2]])
    expect(g.result?.winner).toBeNull()
  })
})

describe('Gift to a chosen player', () => {
  it('only the recipient gets the points', () => {
    const g = setup(3, [CATS, CATS, CATS])
    const next = must(g, { type: 'play', placements: placeWord(g, 'CATS'), madeUp: true, penalty: 'gift', recipient: 2 })
    expect(next.players.map((p) => p.score)).toEqual([0, 0, 10])
    expect(next.history[0]).toMatchObject({ gifted: 10, giftTo: 2 })
  })

  it('needs a valid active recipient with 3+ players, picks the only opponent with 2', () => {
    const g = setup(3, [CATS, CATS, CATS])
    expect(playMade(g, { penalty: 'gift' })).toEqual({ ok: false, error: 'bad-recipient' })
    expect(playMade(g, { penalty: 'gift', recipient: 0 })).toEqual({ ok: false, error: 'bad-recipient' })
    expect(playMade(g, { penalty: 'gift', recipient: 7 })).toEqual({ ok: false, error: 'bad-recipient' })
    const two = setup(2, [CATS, CATS])
    const next = must(two, { type: 'play', placements: placeWord(two, 'CATS'), madeUp: true, penalty: 'gift' })
    expect(next.players.map((p) => p.score)).toEqual([0, 10])
  })
})

describe('Convince them! majority vote', () => {
  it('needs one vote per other player; majority zero wipes, ties and keep stand', () => {
    const g = setup(4, [CATS, CATS, CATS, CATS])
    const score = (votes: ('keep' | 'zero')[]): number => {
      const r = playMade(g, { penalty: 'convince', votes })
      if (!r.ok) throw new Error(r.error)
      return r.state.players[0].score
    }
    expect(score(['zero', 'zero', 'keep'])).toBe(0)
    expect(score(['zero', 'keep', 'keep'])).toBe(10)
    expect(playMade(g, { penalty: 'convince', votes: ['zero'] })).toEqual({ ok: false, error: 'vote-missing' })
    const three = setup(3, [CATS, CATS, CATS])
    const tie = playMade(three, { penalty: 'convince', votes: ['zero', 'keep'] })
    expect(tie.ok && tie.state.players[0].score).toBe(10)
  })

  it('dropped players do not vote', () => {
    let g = setup(3, [CATS, CATS, CATS])
    g = must(g, { type: 'pass' })
    g = must(g, { type: 'concede', recipient: null }) // Blair drops, back to Ann
    g = { ...g, current: 0 }
    expect(playMade(g, { penalty: 'convince', votes: ['zero'] }).ok).toBe(true)
    expect(playMade(g, { penalty: 'convince', votes: ['zero', 'zero'] })).toEqual({ ok: false, error: 'vote-missing' })
  })
})

describe('dropping out', () => {
  it('gives the score to the chosen player, returns the rack and skips the dropper', () => {
    let g = setup(3, [CATS, CATS, CATS])
    g = { ...g, players: g.players.map((p, i) => ({ ...p, score: [30, 20, 10][i] })) }
    const bag = g.bag.length
    g = must(g, { type: 'concede', recipient: 2 })
    expect(g.phase).toBe('playing')
    expect(g.players.map((p) => p.score)).toEqual([0, 20, 40])
    expect(g.players[0]).toMatchObject({ out: true, conceded: true, givenAway: 30, rack: [] })
    expect(g.bag).toHaveLength(bag + 7)
    expect(g.current).toBe(1)
    g = must(g, { type: 'pass' })
    g = must(g, { type: 'pass' })
    expect(g.current).toBe(1) // 0 never gets a turn again
  })

  it('"nobody" keeps the score with the dropper', () => {
    let g = setup(4, [CATS, CATS, CATS, CATS])
    g = { ...g, players: g.players.map((p, i) => ({ ...p, score: i === 0 ? 30 : 0 })) }
    g = must(g, { type: 'concede', recipient: null })
    expect(g.players[0]).toMatchObject({ score: 30, givenAway: 0, out: true })
    expect(g.players.slice(1).map((p) => p.score)).toEqual([0, 0, 0])
  })

  it('rejects a dropped, missing or self recipient', () => {
    let g = setup(4, [CATS, CATS, CATS, CATS])
    expect(reduce(g, { type: 'concede', recipient: 0 })).toEqual({ ok: false, error: 'bad-recipient' })
    expect(reduce(g, { type: 'concede', recipient: 9 })).toEqual({ ok: false, error: 'bad-recipient' })
    g = must(g, { type: 'concede', recipient: 1 })
    g = { ...g, current: 2 }
    expect(reduce(g, { type: 'concede', recipient: 0 })).toEqual({ ok: false, error: 'bad-recipient' })
  })

  it('ends when one player is left; dropped players rank last, latest drop first', () => {
    let g = setup(4, [CATS, CATS, CATS, CATS])
    g = must(g, { type: 'concede', recipient: null }) // 0 drops first, now 1
    g = must(g, { type: 'concede', recipient: null }) // 1 drops, now 2
    g = must(g, { type: 'concede', recipient: 3 }) // 2 drops, 3 is alone
    expect(g.phase).toBe('over')
    expect(g.result).toMatchObject({ reason: 'conceded', winner: 3, conceder: 2, ranking: [[3], [2], [1], [0]] })
    expect(g.result?.adjustments).toEqual([])
  })

  it('does not change the scoreless count; the limit follows the active players', () => {
    let g = setup(3, [CATS, CATS, CATS])
    g = must(g, { type: 'pass' })
    g = must(g, { type: 'pass' })
    expect(g.consecutiveScoreless).toBe(2)
    g = must(g, { type: 'concede', recipient: null }) // Ann (2) drops; Tess up
    expect(g.consecutiveScoreless).toBe(2)
    for (let i = 0; i < 3; i++) g = must(g, { type: 'pass' }) // 5 passes in total
    expect(g.phase).toBe('playing')
    g = must(g, { type: 'pass' }) // 6 = limit for two active players
    expect(g.result?.reason).toBe('scoreless')
  })

  it('a negative score moves too, leaving the dropper on 0', () => {
    let g = setup(3, [CATS, CATS, CATS])
    g = { ...g, players: g.players.map((p, i) => ({ ...p, score: [-5, 20, 10][i] })) }
    g = must(g, { type: 'concede', recipient: 1 })
    expect(g.players.map((p) => p.score)).toEqual([0, 15, 10])
    expect(g.players[0].givenAway).toBe(-5)
  })

  it('dropping out ends the game if the silent turns already reach the smaller limit', () => {
    let g = setup(4, [CATS, CATS, CATS, CATS])
    g = must({ ...g, consecutiveScoreless: 10 }, { type: 'concede', recipient: null })
    expect(g.result?.reason).toBe('scoreless')
  })

  it('a dropped player is left out of rack adjustments', () => {
    let g = setup(3, [CATS, ['A', 'B'], ['C']])
    g = must({ ...g, current: 2 }, { type: 'concede', recipient: null })
    g = { ...g, current: 0, consecutiveScoreless: 5 }
    g = must(g, { type: 'pass' })
    expect(g.result?.adjustments.map((a) => a.player)).toEqual([0, 1])
    expect(g.result?.ranking.at(-1)).toEqual([2])
  })

  it('two players: conceding is unchanged — the other wins, the score stays', () => {
    let g = setup(2, [CATS, CATS])
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, score: 200 } : p)) }
    g = must(g, { type: 'concede', recipient: 1 })
    expect(g.result).toMatchObject({ reason: 'conceded', winner: 1, conceder: 0, ranking: [[1], [0]], adjustments: [] })
    expect(g.players[0].score).toBe(200)
  })
})

describe('normaliseGame', () => {
  it('lets a two-player save without out/ranking fields continue', () => {
    const fresh = setup(2, [CATS, CATS])
    const old = JSON.parse(JSON.stringify(fresh)) as GameState
    for (const p of old.players) { delete p.out; delete p.outAt; delete p.givenAway; delete p.shufflePointsLost; delete p.swapPointsLost }
    delete old.shuffle
    delete old.swap
    const g = normaliseGame(old)
    expect(g.players.every((p) => p.out === false && p.givenAway === 0)).toBe(true)
    const played = must(g, { type: 'play', placements: placeWord(g, 'CATS') })
    expect(played.current).toBe(1)
    const ended = must(must(played, { type: 'pass' }), { type: 'concede' })
    expect(ended.result?.ranking).toEqual([[1], [0]]) // Tess (0) was up again, so Tess conceded
  })

  it('adds a ranking to an old finished result', () => {
    const base = setup(2, [CATS, CATS])
    const over = must({ ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, score: 200 } : p)) }, { type: 'concede' })
    const old = JSON.parse(JSON.stringify(over)) as GameState
    delete (old.result as Partial<NonNullable<GameState['result']>>).ranking
    expect(normaliseGame(old).result?.ranking).toEqual([[1], [0]])
  })
})
