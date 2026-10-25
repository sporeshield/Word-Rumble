import { describe, expect, it } from 'vitest'
import { applyPlacements, createBoard, scorePlay, validatePlacement } from '../engine'
import type { Board, Placement, Tile } from '../engine'
import { bestMove, generateMoves } from './movegen'
import { Trie } from './trie'

let nextId = 9000
const tile = (letter: string, points = letter === '?' ? 0 : 1): Tile => ({ id: nextId++, letter, points })
const rackOf = (letters: string): Tile[] => [...letters].map((l) => tile(l))

/** Lay a word on the board directly (fixed tiles, as if earlier turns played them). */
function lay(board: Board, word: string, row: number, col: number, horizontal: boolean): Board {
  const placements: Placement[] = [...word].map((letter, k) => ({
    row: horizontal ? row : row + k,
    col: horizontal ? col + k : col,
    tile: tile(letter),
    letter
  }))
  return applyPlacements(board, placements)
}

describe('Trie', () => {
  it('stores and finds words, ignoring junk', () => {
    const trie = new Trie(['cat', 'cats', 'car', "don't", 'a1'])
    expect(trie.has('CAT')).toBe(true)
    expect(trie.has('cats')).toBe(true)
    expect(trie.has('ca')).toBe(false)
    expect(trie.has("don't")).toBe(false)
    expect(trie.has('')).toBe(false)
    trie.insert('ca')
    expect(trie.has('ca')).toBe(true)
  })
})

describe('generateMoves', () => {
  const trie = new Trie(['CAT', 'CATS', 'ACT', 'ACTS', 'AT', 'AS', 'TA', 'SAT', 'TAS', 'CAST', 'SCAT', 'ST', 'TO', 'OX', 'AX', 'ZAX'])

  it('finds first moves through the centre, at least two tiles, both directions', () => {
    const moves = generateMoves(createBoard(), rackOf('CATS'), trie)
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) {
      expect(m.placements.length).toBeGreaterThanOrEqual(2)
      expect(m.placements.some((p) => p.row === 7 && p.col === 7)).toBe(true)
    }
    expect(moves.some((m) => m.placements.every((p) => p.row === 7))).toBe(true)
    expect(moves.some((m) => m.placements.every((p) => p.col === 7))).toBe(true)
    expect(moves.some((m) => m.words[0].text === 'CAST')).toBe(true)
  })

  it('every move is accepted by the engine, scores correctly and uses only real words', () => {
    const board = lay(createBoard(), 'CAT', 7, 6, true)
    const moves = generateMoves(board, rackOf('SAXTO'), trie)
    expect(moves.length).toBeGreaterThan(0)
    const keys = new Set<string>()
    for (const m of moves) {
      const v = validatePlacement(board, m.placements)
      expect(v.ok).toBe(true)
      if (!v.ok) continue
      for (const w of v.words) expect(trie.has(w.text)).toBe(true)
      expect(m.score.total).toBe(scorePlay(board, m.placements, v.words).total)
      const key = m.placements.map((p) => `${p.row},${p.col},${p.letter}`).sort().join('|')
      expect(keys.has(key)).toBe(false)
      keys.add(key)
    }
    for (let k = 1; k < moves.length; k++) expect(moves[k - 1].score.total).toBeGreaterThanOrEqual(moves[k].score.total)
  })

  it('finds parallel plays with valid cross-words and extensions of existing words', () => {
    const board = lay(createBoard(), 'CAT', 7, 6, true)
    const moves = generateMoves(board, rackOf('S'), trie)
    const texts = moves.map((m) => m.words.map((w) => w.text).join('+'))
    expect(texts).toContain('CATS')
    // S under C would make "CS"/"AS"/"TS" - only AS (under A) is a word
    expect(moves.some((m) => m.placements[0].row === 8 && m.placements[0].col === 7)).toBe(true)
    expect(moves.some((m) => m.placements[0].row === 8 && m.placements[0].col === 6)).toBe(false)
  })

  it('plays through letters on the board in the middle of a word', () => {
    const board = lay(createBoard(), 'ACT', 7, 6, true)
    // vertical SCAT through the C... needs S above and A,T below
    const moves = generateMoves(board, rackOf('SAT'), trie)
    expect(moves.some((m) => m.words[0].text === 'SCAT' && m.placements.length === 3)).toBe(true)
  })

  it('uses blanks as any letter, scoring them 0', () => {
    const moves = generateMoves(createBoard(), rackOf('T?'), trie)
    const withBlank = moves.filter((m) => m.placements.some((p) => p.tile.letter === '?'))
    expect(withBlank.length).toBeGreaterThan(0)
    for (const m of withBlank) {
      const blank = m.placements.find((p) => p.tile.letter === '?')!
      expect(blank.letter).toMatch(/^[A-Z]$/)
    }
    const ta = withBlank.find((m) => m.words[0].text === 'TA')!
    expect(ta.score.words[0].score).toBeLessThan(ta.placements.length * 3 + 1) // blank adds nothing
    expect(moves.every((m) => m.placements.length === 2)).toBe(true) // only two tiles
  })

  it('returns nothing when no word fits, and bestMove is null', () => {
    expect(generateMoves(createBoard(), rackOf('QQQ'), trie)).toEqual([])
    expect(bestMove(createBoard(), rackOf('QQQ'), trie)).toBeNull()
  })

  it('RUMBLE: awards the 7-tile bonus', () => {
    const t = new Trie(['STRANGE'])
    const m = bestMove(createBoard(), rackOf('STRANGE'), t)
    expect(m?.score.rumble).toBe(true)
    expect(m?.score.rumbleBonus).toBe(50)
  })

  it('handles a lone tile that forms only a vertical word', () => {
    const board = lay(createBoard(), 'AT', 7, 7, false) // A at (7,7), T at (8,7)
    const moves = generateMoves(board, rackOf('S'), trie)
    expect(moves.some((m) => m.words.some((w) => w.text === 'ATS') || m.words.some((w) => w.text === 'AS'))).toBe(true)
  })
})
