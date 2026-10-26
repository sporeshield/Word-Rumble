import { describe, expect, it } from 'vitest'
import { Trie } from '../ai/trie'
import { generateMoves } from '../ai/movegen'
import { BURST_POOLS, createBurstDecks, drawBurst, type BurstDecks } from '../fx/bursts'
import {
  CENTER, DEFAULT_POWER, NO_POWER, PREMIUM_LAYOUT, TILE_DISTRIBUTION, buildLayout, createBoard, createGame, isPowerPremium,
  normaliseGame, normalisePower, powerTotal, previewPlay, randomPower, reduce, scorePlay, validatePlacement,
  type GameState, type Placement, type Premium, type PowerCounts, type Tile
} from './index'

let nextId = 20000
const tile = (letter: string): Tile => ({ id: nextId++, letter, points: letter === '?' ? 0 : (TILE_DISTRIBUTION[letter]?.[1] ?? 1) })

/** Small seeded generator so the placement tests are repeatable. */
function seeded(seed: number): (max: number) => number {
  let s = seed >>> 0
  return (max) => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max)
  }
}

const powerCells = (layout: Premium[][]): { r: number; c: number; p: Premium }[] =>
  layout.flatMap((row, r) => row.map((p, c) => ({ r, c, p, classic: PREMIUM_LAYOUT[r][c] })).filter((x) => isPowerPremium(x.p)))

describe('buildLayout', () => {
  it('keeps every Classic square and adds exactly the chosen counts on plain squares', () => {
    const power: PowerCounts = { pl5: 3, pl10: 1, qw: 4, pw5: 0, pw10: 2 }
    const layout = buildLayout(power, seeded(1))
    const cells = powerCells(layout)
    expect(cells).toHaveLength(powerTotal(power))
    for (const kind of ['PL5', 'PL10', 'QW', 'PW5', 'PW10'] as const) {
      expect(cells.filter((x) => x.p === kind)).toHaveLength({ PL5: 3, PL10: 1, QW: 4, PW5: 0, PW10: 2 }[kind])
    }
    for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
      if (!isPowerPremium(layout[r][c])) expect(layout[r][c]).toBe(PREMIUM_LAYOUT[r][c])
      else expect(PREMIUM_LAYOUT[r][c]).toBe('NONE')
    }
  })

  it('is the Classic layout (a copy) with no power squares', () => {
    const layout = buildLayout(NO_POWER, seeded(2))
    expect(layout).toEqual(PREMIUM_LAYOUT)
    expect(layout).not.toBe(PREMIUM_LAYOUT)
  })

  it('obeys the fairness rules over many seeds', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const layout = buildLayout(DEFAULT_POWER, seeded(seed))
      const cells = powerCells(layout)
      expect(cells).toHaveLength(9)
      for (const a of cells) {
        // Never the centre or beside the centre star.
        expect(Math.max(Math.abs(a.r - CENTER), Math.abs(a.c - CENTER))).toBeGreaterThan(1)
        for (const b of cells) {
          if (a === b) continue
          expect(Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c))).toBeGreaterThan(1) // not touching
          if (a.p === b.p) { expect(a.r).not.toBe(b.r); expect(a.c).not.toBe(b.c) }
        }
      }
      // Round-robin dealing: nine squares over four quadrants never leaves one empty.
      const quads = new Set(cells.map((x) => (x.r <= CENTER ? 0 : 2) + (x.c <= CENTER ? 0 : 1)))
      expect(quads.size).toBe(4)
    }
  })

  it('varies between games', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(buildLayout(DEFAULT_POWER, seeded(100 + i)))))
    expect(seen.size).toBeGreaterThan(15)
  })

  it('places the maximum (20) and never breaks the centre rule even when it must relax', () => {
    const all: PowerCounts = { pl5: 4, pl10: 4, qw: 4, pw5: 4, pw10: 4 }
    for (let seed = 1; seed <= 50; seed++) {
      const cells = powerCells(buildLayout(all, seeded(seed)))
      expect(cells).toHaveLength(20)
      for (const a of cells) expect(Math.max(Math.abs(a.r - CENTER), Math.abs(a.c - CENTER))).toBeGreaterThan(1)
    }
  })

  it('cleans up counts and has a Surprise me roll', () => {
    expect(normalisePower({ pl5: 9, pl10: -2, qw: 1.4 })).toEqual({ pl5: 4, pl10: 0, qw: 1, pw5: 0, pw10: 0 })
    expect(normalisePower(undefined)).toEqual(NO_POWER)
    for (let i = 0; i < 20; i++) {
      for (const n of Object.values(randomPower(seeded(i)))) expect(n).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('power square scoring', () => {
  const empty = createBoard()
  const cat = (): Placement[] => [...'CAT'].map((letter, i) => ({ row: 7, col: 6 + i, tile: tile(letter), letter }))
  const withPower = (squares: Record<string, Premium>): Premium[][] => {
    const layout = PREMIUM_LAYOUT.map((row) => row.slice())
    for (const [key, p] of Object.entries(squares)) { const [r, c] = key.split(',').map(Number); layout[r][c] = p }
    return layout
  }
  const score = (layout: Premium[][], placements = cat(), board = empty): number => {
    const r = validatePlacement(board, placements)
    if (!r.ok) throw new Error('invalid')
    return scorePlay(board, placements, r.words, layout).total
  }

  // CAT: C3 A1 T1 = 5; the centre star doubles the word.
  it('Classic is unchanged', () => expect(score(PREMIUM_LAYOUT)).toBe(10))
  it('power letters multiply one tile', () => {
    expect(score(withPower({ '7,8': 'PL5' }))).toBe((3 + 1 + 5) * 2)
    expect(score(withPower({ '7,8': 'PL10' }))).toBe((3 + 1 + 10) * 2)
  })
  it('word squares multiply the word', () => {
    expect(score(withPower({ '7,8': 'QW' }))).toBe(5 * 2 * 4)
    expect(score(withPower({ '7,8': 'PW5' }))).toBe(5 * 2 * 5)
    expect(score(withPower({ '7,8': 'PW10' }))).toBe(5 * 2 * 10)
  })
  it('letter multipliers apply before word multipliers, and word multipliers stack', () => {
    expect(score(withPower({ '7,6': 'PL5', '7,8': 'PW5' }))).toBe((15 + 1 + 1) * 2 * 5)
    expect(score(withPower({ '7,6': 'QW', '7,8': 'PW10' }))).toBe(5 * 2 * 4 * 10)
  })
  it('only newly placed tiles trigger them', () => {
    const layout = withPower({ '7,8': 'PW10' })
    const board = createBoard()
    board[7][8] = { tile: tile('T'), letter: 'T' }
    const placements: Placement[] = [
      { row: 7, col: 6, tile: tile('C'), letter: 'C' },
      { row: 7, col: 7, tile: tile('A'), letter: 'A' }
    ]
    const r = validatePlacement(board, placements)
    if (!r.ok) throw new Error('invalid')
    const s = scorePlay(board, placements, r.words, layout)
    expect(s.total).toBe(10) // START doubles it; the old T under PW10 does not
    expect(s.premiumsHit).toEqual(['START'])
  })
  it('records the power squares hit and the live preview uses the layout', () => {
    const layout = withPower({ '7,8': 'PW10' })
    const placements = cat()
    const r = validatePlacement(empty, placements)
    if (!r.ok) throw new Error('invalid')
    expect(scorePlay(empty, placements, r.words, layout).premiumsHit).toContain('PW10')
    const preview = previewPlay(empty, placements, layout)
    expect(preview.kind === 'ok' && preview.score.total).toBe(100)
  })
  it('the move generator scores on the given layout exactly as the engine does', () => {
    const layout = buildLayout({ pl5: 4, pl10: 4, qw: 4, pw5: 4, pw10: 4 }, seeded(7))
    layout[7][8] = 'PW10'
    layout[7][6] = 'PL5'
    const trie = new Trie(['cat', 'act', 'tact', 'cats', 'scat', 'at', 'ta', 'sat'])
    const rack = [...'CATS'].map(tile)
    const moves = generateMoves(empty, rack, trie, layout)
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) {
      const v = validatePlacement(empty, m.placements)
      if (!v.ok) throw new Error('generated an illegal move')
      expect(m.score.total).toBe(scorePlay(empty, m.placements, v.words, layout).total)
    }
    const classic = generateMoves(empty, rack, trie)
    expect(moves[0].score.total).toBeGreaterThan(classic[0].score.total)
  })
})

describe('Wild games', () => {
  const options = { mode: 'two' as const, names: ['Shane', 'Dawn'], timerSeconds: null, hints: 'free' as const, madeUp: 'no' as const }

  it('a Wild game gets its own layout; Classic (or all zero) keeps the standard one', () => {
    expect(createGame(options).layout).toEqual(PREMIUM_LAYOUT)
    expect(createGame({ ...options, power: NO_POWER }).layout).toEqual(PREMIUM_LAYOUT)
    const wild = createGame({ ...options, power: DEFAULT_POWER })
    expect(powerCells(wild.layout)).toHaveLength(powerTotal(DEFAULT_POWER))
    expect(JSON.parse(JSON.stringify(wild)).layout).toEqual(wild.layout)
  })

  it('plays are scored on the game layout and draw a power burst', () => {
    const base = createGame({ ...options, power: DEFAULT_POWER })
    const layout = PREMIUM_LAYOUT.map((row) => row.slice())
    layout[7][8] = 'PW10'
    const game: GameState = {
      ...base, layout, current: 0,
      players: base.players.map((p, i) => (i === 0 ? { ...p, rack: [...'CATSERD'].map(tile) } : p))
    }
    const r = reduce(game, { type: 'play', placements: [...'CAT'].map((letter, i) => ({ row: 7, col: 6 + i, tile: game.players[0].rack[i], letter })) })
    if (!r.ok) throw new Error(r.error)
    expect(r.state.players[0].score).toBe(100)
    expect(r.state.lastBurst?.tier).toBe('powerword10')
  })

  it('an old save without layout or the new burst tiers still plays', () => {
    const fresh = createGame(options)
    const old = JSON.parse(JSON.stringify(fresh))
    delete old.layout
    for (const tier of ['power5', 'power10', 'quad', 'powerword5', 'powerword10']) delete old.bursts[tier]
    const fixed = normaliseGame(old as GameState)
    expect(fixed.layout).toEqual(PREMIUM_LAYOUT)
    for (const tier of Object.keys(BURST_POOLS)) expect(fixed.bursts[tier as keyof BurstDecks]).toBeDefined()
    // Used words in the old tiers stay used.
    expect(fixed.bursts.dw).toEqual(fresh.bursts.dw)
  })
})

describe('power burst tiers', () => {
  it('have their own pools, unique words, and borrow from top when dry', () => {
    for (const tier of ['power5', 'power10', 'quad', 'powerword5', 'powerword10'] as const) {
      expect(BURST_POOLS[tier].length).toBeGreaterThanOrEqual(18)
    }
    let decks = createBurstDecks()
    const seen = new Set<string>()
    for (let i = 0; i < BURST_POOLS.quad.length; i++) {
      const d = drawBurst(decks, 'quad')
      decks = d.decks
      expect(seen.has(d.burst.text)).toBe(false)
      seen.add(d.burst.text)
    }
    const borrowed = drawBurst(decks, 'quad')
    expect(BURST_POOLS.top).toContain(borrowed.burst.text)
  })
})
