import { describe, expect, it } from 'vitest'
import { BURST_POOLS, createBurstDecks, drawBurst } from '../fx/bursts'
import {
  HINT_COST_MAX, HINT_COST_MIN, createGame, drawForFirstTurn, penaltySlices, reduce, rollHintCost, scorelessLimit,
  spinPenalty, type GameAction, type GameOptions, type GameState, type Placement, type Tile
} from './index'

let nextId = 5000
const tile = (letter: string, points = letter === '?' ? 0 : 1): Tile => ({ id: nextId++, letter, points })

const twoPlayer: GameOptions = { mode: 'two', names: ['Shane', 'Dawn'], timerSeconds: null, hints: 'penalty', madeUp: 'penalty' }
const solo: GameOptions = { mode: 'solo', names: ['Shane'], timerSeconds: null, hints: 'free', madeUp: 'penalty' }

/** A fresh game with the given racks and Shane to move. */
function setup(options: GameOptions, racks: string[][] = [['C', 'A', 'T', 'S', 'E', 'R', 'D'], ['A', 'B', 'C', 'D', 'E', 'F', 'G']]): GameState {
  const game = createGame(options)
  return {
    ...game, current: 0,
    players: game.players.map((p, i) => ({ ...p, rack: (racks[i] ?? []).map((l) => tile(l)) }))
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

describe('first-turn draw & setup', () => {
  it('lowest letter wins, blank beats all, ties redraw', () => {
    for (let i = 0; i < 50; i++) {
      const { rounds, starter } = drawForFirstTurn(2)
      const last = rounds[rounds.length - 1]
      const rank = (t: Tile): number => (t.letter === '?' ? -1 : t.letter.charCodeAt(0))
      const winner = last.reduce((a, b) => (rank(b.tile) < rank(a.tile) ? b : a))
      expect(last.find((s) => s.player === starter)!.tile).toBe(winner.tile)
      for (const round of rounds.slice(0, -1)) {
        expect(new Set(round.map((s) => rank(s.tile))).size).toBe(1) // earlier rounds were ties
      }
    }
  })

  it('deals 7 tiles each from a full 108 set; solo skips the draw', () => {
    const g = createGame(twoPlayer)
    expect(g.players.map((p) => p.rack.length)).toEqual([7, 7])
    expect(g.bag).toHaveLength(94)
    const s = createGame(solo)
    expect(s.firstDraw).toEqual([])
    expect(s.current).toBe(0)
    expect(s.bag).toHaveLength(101)
  })
})

describe('play', () => {
  it('scores, refills the rack and passes the turn', () => {
    const g = setup(twoPlayer)
    const next = must(g, { type: 'play', placements: placeWord(g, 'CATS') })
    expect(next.players[0].score).toBe(10) // C,A,T,S = 5 with the double-letter, start square doubles
    expect(next.players[0].rack).toHaveLength(7)
    expect(next.current).toBe(1)
    expect(next.consecutiveScoreless).toBe(0)
    expect(next.lastBurst?.tier).toBe('dw')
  })

  it('rejects tiles that are not in the rack and bad placements', () => {
    const g = setup(twoPlayer)
    const bad = [{ row: 7, col: 7, tile: tile('Z'), letter: 'Z' }, { row: 7, col: 8, tile: tile('A'), letter: 'A' }]
    expect(reduce(g, { type: 'play', placements: bad })).toEqual({ ok: false, error: 'tile-not-in-rack' })
    expect(reduce(g, { type: 'play', placements: placeWord(g, 'CATS', 0, 0) })).toEqual({ ok: false, error: 'first-move-center' })
  })

  it('RUMBLE bonus counts and a top-tier burst fires', () => {
    const g = setup(twoPlayer)
    const next = must(g, { type: 'play', placements: placeWord(g, 'DCASTER') })
    expect(next.players[0].rumbles).toBe(1)
    expect(next.history[0].rumble).toBe(true)
    expect(next.lastBurst?.tier).toBe('top')
  })

  it('ends the game when a player goes out on an empty bag, with adjustments', () => {
    const g = { ...setup(twoPlayer, [['C', 'A', 'T'], ['Q', 'A']]), bag: [] as Tile[] }
    const next = must(g, { type: 'play', placements: placeWord(g, 'CAT') })
    expect(next.phase).toBe('over')
    expect(next.result?.reason).toBe('out')
    expect(next.result?.preAdjust).toEqual([8, 0])
    // Q and A are worth 1 each in this helper
    expect(next.result?.finalScores).toEqual([10, -2])
    expect(next.result?.winner).toBe(0)
    expect(reduce(next, { type: 'pass' })).toEqual({ ok: false, error: 'game-over' })
  })
})

describe('exchange and pass', () => {
  it('exchanges only when 7+ tiles remain in the bag', () => {
    const g = setup(twoPlayer)
    const ids = g.players[0].rack.slice(0, 2).map((t) => t.id)
    const next = must(g, { type: 'exchange', tileIds: ids })
    expect(next.players[0].rack).toHaveLength(7)
    expect(next.bag).toHaveLength(g.bag.length)
    expect(next.current).toBe(1)
    expect(next.consecutiveScoreless).toBe(1)
    expect(reduce({ ...g, bag: g.bag.slice(0, 6) }, { type: 'exchange', tileIds: ids })).toEqual({ ok: false, error: 'exchange-not-allowed' })
    expect(reduce(g, { type: 'exchange', tileIds: [] })).toEqual({ ok: false, error: 'bad-exchange' })
    expect(reduce(g, { type: 'exchange', tileIds: [-1] })).toEqual({ ok: false, error: 'bad-exchange' })
  })

  it('six scoreless turns end a two-player game and everyone subtracts their rack', () => {
    let g = setup(twoPlayer)
    for (let i = 0; i < 5; i++) g = must(g, { type: 'pass' })
    expect(g.phase).toBe('playing')
    g = must(g, { type: 'timeout' })
    expect(g.phase).toBe('over')
    expect(g.result?.reason).toBe('scoreless')
    expect(g.result?.finalScores).toEqual([-7, -7])
    expect(g.result?.winner).toBeNull()
  })

  it('a scoring play resets the scoreless count; solo ends after 3', () => {
    let g = setup(twoPlayer)
    g = must(g, { type: 'pass' })
    g = must(g, { type: 'play', placements: placeWord(g, 'ABE') })
    expect(g.consecutiveScoreless).toBe(0)
    expect(scorelessLimit(1)).toBe(3)
    let s = setup(solo, [['A', 'B']])
    s = must(s, { type: 'pass' })
    s = must(s, { type: 'pass' })
    s = must(s, { type: 'pass' })
    expect(s.result?.reason).toBe('scoreless')
    expect(s.result?.finalScores).toEqual([-2])
  })
})

describe('admit defeat and finish', () => {
  it('conceding hands the win to the other player whatever the score', () => {
    let g = setup(twoPlayer)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, score: 200 } : p)) }
    g = must(g, { type: 'concede' })
    expect(g.result).toMatchObject({ reason: 'conceded', winner: 1, conceder: 0, adjustments: [] })
    expect(g.players[0].conceded).toBe(true)
    expect(g.players[0].score).toBe(200)
  })

  it('solo finish subtracts the rack; finish is solo only', () => {
    expect(reduce(setup(twoPlayer), { type: 'finish' })).toEqual({ ok: false, error: 'not-solo' })
    const s = must(setup(solo, [['A', 'B', 'C']]), { type: 'finish' })
    expect(s.result).toMatchObject({ reason: 'finished', winner: null, finalScores: [-3] })
  })
})

describe('made-up words and the penalty wheel', () => {
  const play = (g: GameState, extra: Partial<Extract<GameAction, { type: 'play' }>>): GameState =>
    must(g, { type: 'play', placements: placeWord(g, 'CATS'), madeUp: true, ...extra })

  it('respects the setup option', () => {
    const g = setup({ ...twoPlayer, madeUp: 'no' })
    expect(reduce(g, { type: 'play', placements: placeWord(g, 'CATS'), madeUp: true })).toEqual({ ok: false, error: 'made-up-not-allowed' })
    const free = setup({ ...twoPlayer, madeUp: 'free' })
    const next = play(free, {})
    expect(next.players[0].score).toBe(10)
    expect(next.players[0].madeUpCount).toBe(1)
    expect(next.lastBurst?.tier).toBe('fibber')
    expect(reduce(setup(twoPlayer), { type: 'play', placements: placeWord(setup(twoPlayer), 'CATS'), madeUp: true }))
      .toEqual({ ok: false, error: 'penalty-missing' })
  })

  it('half / zero / minus10 / gift / skip / convince / lucky', () => {
    const g = setup(twoPlayer)
    expect(play(g, { penalty: 'half' }).players[0].score).toBe(5)
    expect(play(g, { penalty: 'zero' }).players[0].score).toBe(0)
    expect(play(g, { penalty: 'minus10' }).players[0].score).toBe(0)
    const gift = play(g, { penalty: 'gift' })
    expect(gift.players.map((p) => p.score)).toEqual([0, 10])
    expect(play(g, { penalty: 'lucky' }).players[0].score).toBe(10)
    expect(play(g, { penalty: 'lucky' }).players[0].penaltyCount).toBe(0)
    expect(play(g, { penalty: 'convince', vote: 'keep' }).players[0].score).toBe(10)
    expect(play(g, { penalty: 'convince', vote: 'zero' }).players[0].score).toBe(0)
    expect(reduce(g, { type: 'play', placements: placeWord(g, 'CATS'), madeUp: true, penalty: 'convince' }))
      .toEqual({ ok: false, error: 'vote-missing' })
    expect(reduce(g, { type: 'play', placements: placeWord(g, 'CATS'), madeUp: true, penalty: 'minus20' }))
      .toEqual({ ok: false, error: 'invalid-penalty' })
  })

  it('skip: the opponent plays twice in a row', () => {
    let g = play(setup(twoPlayer), { penalty: 'skip' })
    // Shane (0) played, Dawn (1) is up. Dawn passes, Shane is skipped, Dawn again.
    expect(g.current).toBe(1)
    g = must(g, { type: 'pass' })
    expect(g.current).toBe(1)
    expect(g.history.at(-1)?.kind).toBe('skipped')
    expect(g.players[0].skipNext).toBe(false)
  })

  it('rack wipe swaps the whole rack, or costs 10 when the bag is low', () => {
    const g = setup(twoPlayer)
    const wiped = play(g, { penalty: 'rackwipe' })
    expect(wiped.players[0].rack).toHaveLength(7)
    expect(wiped.players[0].score).toBe(10)
    expect(wiped.bag).toHaveLength(g.bag.length - 4)
    const low = play({ ...g, bag: g.bag.slice(0, 5) }, { penalty: 'rackwipe' })
    expect(low.players[0].score).toBe(0)
  })

  it('solo uses −20 instead of the opponent slices', () => {
    const g = setup(solo, [['C', 'A', 'T', 'S']])
    expect(play(g, { penalty: 'minus20' }).players[0].score).toBe(-10)
    expect(reduce(g, { type: 'play', placements: placeWord(g, 'CATS'), madeUp: true, penalty: 'gift' }))
      .toEqual({ ok: false, error: 'invalid-penalty' })
    expect(penaltySlices(true)).not.toContain('gift')
    expect(penaltySlices(false)).toHaveLength(8)
  })

  it('spinPenalty returns a slice from the right wheel', () => {
    for (let i = 0; i < 200; i++) {
      const { index, outcome } = spinPenalty(false)
      expect(penaltySlices(false)[index]).toBe(outcome)
      expect(spinPenalty(true).outcome).not.toBe('gift')
    }
  })
})

describe('hints', () => {
  it('locks the quoted cost for the turn and charges on accept', () => {
    let g = setup(twoPlayer)
    g = must(g, { type: 'hint-offer', cost: 12 })
    g = must(g, { type: 'hint-decline' })
    g = must(g, { type: 'hint-offer', cost: 29 })
    expect(g.hint).toEqual({ cost: 12 })
    g = must(g, { type: 'hint-accept' })
    expect(g.players[0]).toMatchObject({ score: -12, hintsUsed: 1, hintPointsLost: 12 })
    expect(g.lastBurst?.tier).toBe('hint')
    expect(g.hint).toBeNull() // next hint gets a fresh price
    expect(reduce(g, { type: 'hint-accept' })).toEqual({ ok: false, error: 'hint-not-offered' })
  })

  it('clears the lock on a new turn; free and off modes', () => {
    let g = must(setup(twoPlayer), { type: 'hint-offer', cost: 9 })
    g = must(g, { type: 'pass' })
    expect(g.hint).toBeNull()
    const free = must(setup(solo), { type: 'hint-accept' })
    expect(free.players[0]).toMatchObject({ score: 0, hintsUsed: 1 })
    expect(reduce(setup({ ...twoPlayer, hints: 'off' }), { type: 'hint-offer', cost: 5 })).toEqual({ ok: false, error: 'hints-off' })
  })

  it('rolls costs in range', () => {
    for (let i = 0; i < 200; i++) {
      const c = rollHintCost()
      expect(c).toBeGreaterThanOrEqual(HINT_COST_MIN)
      expect(c).toBeLessThanOrEqual(HINT_COST_MAX)
    }
  })
})

describe('burst decks', () => {
  it('has unique words across every tier', () => {
    const all = Object.values(BURST_POOLS).flat()
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBeGreaterThanOrEqual(120)
  })

  it('never repeats a word until a tier is exhausted, then borrows from the tier below', () => {
    let decks = createBurstDecks()
    const seen = new Set<string>()
    for (let i = 0; i < BURST_POOLS.tw.length; i++) {
      const r = drawBurst(decks, 'tw')
      decks = r.decks
      expect(r.burst.tier).toBe('tw')
      expect(seen.has(r.burst.text)).toBe(false)
      seen.add(r.burst.text)
    }
    const borrowed = drawBurst(decks, 'tw')
    expect(BURST_POOLS.dw).toContain(borrowed.burst.text)
    expect(seen.has(borrowed.burst.text)).toBe(false)
  })

  it('keeps its position in game state across turns and survives JSON (autosave)', () => {
    let g = setup(twoPlayer)
    const before = g.bursts.dw.length
    g = must(g, { type: 'play', placements: placeWord(g, 'CATS') })
    const restored: GameState = JSON.parse(JSON.stringify(g))
    expect(restored.bursts.dw).toHaveLength(before - 1)
    expect(restored.bursts.dw).not.toContain(g.lastBurst!.text)
  })
})

describe('review regressions', () => {
  it('rejects a fabricated tile that reuses a rack tile id', () => {
    const g = setup(twoPlayer)
    const real = g.players[0].rack[0]
    const fake: Placement[] = [
      { row: 7, col: 7, tile: { id: real.id, letter: 'Z', points: 10 }, letter: 'Z' },
      { row: 7, col: 8, tile: g.players[0].rack[1], letter: g.players[0].rack[1].letter }
    ]
    expect(reduce(g, { type: 'play', placements: fake })).toEqual({ ok: false, error: 'tile-not-in-rack' })
  })

  it('solo: skip slice is a no-op and only passes end the run', () => {
    let g = setup(solo, [['C', 'A', 'T', 'S', 'E', 'R', 'D']])
    g = must(g, { type: 'play', placements: placeWord(g, 'CAT'), madeUp: true, penalty: 'skip' })
    expect(g.players[0].skipNext).toBe(false)
    g = must(g, { type: 'pass' })
    g = must(g, { type: 'pass' })
    g = must(g, { type: 'exchange', tileIds: [g.players[0].rack[0].id] })
    expect(g.phase).toBe('playing')
  })

  it('a skipped turn counts as scoreless', () => {
    let g = setup(twoPlayer)
    g = { ...g, consecutiveScoreless: 4, players: g.players.map((p, i) => (i === 1 ? { ...p, skipNext: true } : p)) }
    g = must(g, { type: 'pass' }) // 5th scoreless, then Dawn's skipped turn is the 6th
    expect(g.result?.reason).toBe('scoreless')
  })

  it('rejects out-of-range hint quotes', () => {
    const g = setup(twoPlayer)
    for (const cost of [-30, 4, 31, NaN, Infinity]) {
      expect(reduce(g, { type: 'hint-offer', cost })).toEqual({ ok: false, error: 'bad-hint-cost' })
    }
  })

  it('a tier that runs dry borrows unused words instead of repeating', () => {
    let decks = createBurstDecks()
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const r = drawBurst(decks, 'dl')
      decks = r.decks
      expect(seen.has(r.burst.text)).toBe(false)
      seen.add(r.burst.text)
    }
  })
})
