import { describe, expect, it } from 'vitest'
import {
  PREMIUM_LAYOUT, TILE_DISTRIBUTION, applyPlacements, createBag, createBoard, createTileSet, drawTiles,
  returnTiles, scorePlay, shuffle, validatePlacement,
  type Board, type Placement, type Premium, type Tile
} from './index'

let nextId = 1000
const tile = (letter: string, points?: number): Tile => ({
  id: nextId++,
  letter,
  points: points ?? (letter === '?' ? 0 : (TILE_DISTRIBUTION[letter]?.[1] ?? 1))
})

/** Build placements for a word starting at (row,col). Use '*' + letter for a blank standing in for that letter. */
function word(text: string, row: number, col: number, horizontal = true, blanks: number[] = []): Placement[] {
  return [...text].map((letter, i) => ({
    row: horizontal ? row : row + i,
    col: horizontal ? col + i : col,
    tile: blanks.includes(i) ? tile('?') : tile(letter),
    letter
  }))
}

function play(board: Board, placements: Placement[]): Board {
  const result = validatePlacement(board, placements)
  expect(result.ok).toBe(true)
  return applyPlacements(board, placements)
}

const count = (premium: Premium): number => PREMIUM_LAYOUT.flat().filter((p) => p === premium).length

describe('tile set', () => {
  it('has 108 tiles with unique ids and the planned totals', () => {
    const tiles = createTileSet()
    expect(tiles).toHaveLength(108)
    expect(new Set(tiles.map((t) => t.id)).size).toBe(108)
    expect(tiles.filter((t) => t.letter === '?')).toHaveLength(2)
    expect(tiles.filter((t) => t.letter === 'E')).toHaveLength(13)
    expect(tiles.find((t) => t.letter === 'Q')!.points).toBe(10)
  })
})

describe('board layout', () => {
  it('has the planned number of each premium square', () => {
    expect(count('START')).toBe(1)
    expect(count('TW')).toBe(8)
    expect(count('DW')).toBe(16)
    expect(count('TL')).toBe(16)
    expect(count('DL')).toBe(24)
  })
  it('is symmetric in all eight ways', () => {
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        expect(PREMIUM_LAYOUT[r][c]).toBe(PREMIUM_LAYOUT[c][r])
        expect(PREMIUM_LAYOUT[r][c]).toBe(PREMIUM_LAYOUT[14 - r][c])
        expect(PREMIUM_LAYOUT[r][c]).toBe(PREMIUM_LAYOUT[r][14 - c])
      }
    }
  })
  it('puts the star in the centre, 2x letter in the corners and 3x word three in from the corners', () => {
    expect(PREMIUM_LAYOUT[7][7]).toBe('START')
    expect(PREMIUM_LAYOUT[0][0]).toBe('DL')
    expect(PREMIUM_LAYOUT[3][0]).toBe('TW')
    expect(PREMIUM_LAYOUT[0][3]).toBe('TW')
    expect(PREMIUM_LAYOUT[7][0]).toBe('DL')
  })
})

describe('bag', () => {
  it('shuffles without losing tiles and draws from the bag', () => {
    const tiles = createTileSet()
    const bag = createBag(tiles)
    expect(bag.map((t) => t.id).sort((a, b) => a - b)).toEqual(tiles.map((t) => t.id))
    const { drawn, bag: rest } = drawTiles(bag, 7)
    expect(drawn).toHaveLength(7)
    expect(rest).toHaveLength(101)
    expect(drawTiles(rest.slice(0, 3), 7).drawn).toHaveLength(3)
  })
  it('actually reorders (not the identity for 108 tiles)', () => {
    const tiles = createTileSet()
    expect(shuffle(tiles).map((t) => t.id)).not.toEqual(tiles.map((t) => t.id))
  })
  it('returnTiles keeps every tile', () => {
    const bag = createBag(createTileSet())
    const { drawn, bag: rest } = drawTiles(bag, 7)
    expect(returnTiles(rest, drawn)).toHaveLength(108)
  })
})

describe('placement rules', () => {
  const empty = createBoard()

  it('first word must cover the centre and have 2+ letters', () => {
    expect(validatePlacement(empty, word('CAT', 7, 5))).toMatchObject({ ok: true })
    expect(validatePlacement(empty, word('CAT', 7, 8))).toEqual({ ok: false, error: 'first-move-center' })
    expect(validatePlacement(empty, word('A', 7, 7))).toEqual({ ok: false, error: 'first-move-too-short' })
    expect(validatePlacement(empty, word('AT', 7, 6))).toMatchObject({ ok: true })
  })
  it('rejects empty, out of bounds and non-A-Z letters', () => {
    expect(validatePlacement(empty, [])).toEqual({ ok: false, error: 'no-tiles' })
    expect(validatePlacement(empty, word('CAT', 7, 13))).toEqual({ ok: false, error: 'out-of-bounds' })
    const unassigned = word('CAT', 7, 6)
    unassigned[1] = { ...unassigned[1], tile: tile('?'), letter: '?' }
    expect(validatePlacement(empty, unassigned)).toEqual({ ok: false, error: 'blank-letter-missing' })
  })
  it('rejects diagonals and gaps', () => {
    const diag: Placement[] = [
      { row: 7, col: 7, tile: tile('A'), letter: 'A' },
      { row: 8, col: 8, tile: tile('T'), letter: 'T' }
    ]
    expect(validatePlacement(empty, diag)).toEqual({ ok: false, error: 'not-in-line' })
    const gapped = word('CAT', 7, 6).filter((_, i) => i !== 1)
    expect(validatePlacement(empty, gapped)).toEqual({ ok: false, error: 'gap' })
  })
  it('allows gaps filled by existing tiles', () => {
    const board = play(empty, word('CAT', 7, 6))
    // Lay S (7,9)... instead drop a vertical word crossing: use A at (7,7) existing; place across with gap over it.
    const placements: Placement[] = [
      { row: 6, col: 7, tile: tile('B'), letter: 'B' },
      { row: 8, col: 7, tile: tile('D'), letter: 'D' }
    ]
    const r = validatePlacement(board, placements)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.words[0].text).toBe('BAD')
  })
  it('requires connection and refuses occupied squares', () => {
    const board = play(empty, word('CAT', 7, 6))
    expect(validatePlacement(board, word('DOG', 1, 1))).toEqual({ ok: false, error: 'not-connected' })
    expect(validatePlacement(board, word('DOG', 7, 6))).toEqual({ ok: false, error: 'occupied' })
    expect(validatePlacement(board, word('DOG', 8, 6))).toMatchObject({ ok: true })
  })
  it('collects cross words', () => {
    const board = play(empty, word('CAT', 7, 6))
    const r = validatePlacement(board, word('AT', 8, 6)) // under C and A: CA... A under C -> "CA", T under A -> "AT"
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.words.map((w) => w.text).sort()).toEqual(['AT', 'AT', 'CA'].sort())
  })
  it('a single tile can form a vertical word only', () => {
    const board = play(empty, word('CAT', 7, 6))
    const r = validatePlacement(board, [{ row: 8, col: 8, tile: tile('S'), letter: 'S' }])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.words.map((w) => w.text)).toEqual(['TS'])
  })
  it('extending a word forms the full word', () => {
    const board = play(empty, word('CAT', 7, 6))
    const r = validatePlacement(board, word('S', 7, 9))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.words.map((w) => w.text)).toEqual(['CATS'])
  })
})

describe('scoring', () => {
  const empty = createBoard()

  it('first play: letters plus centre star acts as 2x word', () => {
    // CAT across row 7 cols 6..8 -> DW? (0,1)->none, centre START, (0,1) none. C3 A1 T1 = 5, x2 = 10
    const placements = word('CAT', 7, 6)
    const r = validatePlacement(empty, placements)
    if (!r.ok) throw new Error('invalid')
    const s = scorePlay(empty, placements, r.words)
    expect(s.total).toBe(10)
    expect(s.premiumsHit).toContain('START')
  })
  it('applies letter premiums before word premiums', () => {
    // Row 7 cols 3..7: (0,4) TL at col 3 and col 11; (0,2) DL at col 5; (0,6) DW at col 1/13.
    // "QUIZ" at cols 4..7? use cols 3..7: Q on TL(3x10=30), U(4)=2, I(5,DL)=1*2=2, Z(6)=10... pick a clear case:
    const placements = word('JOKES', 7, 3) // J@3 TL, O@4 plain, K@5 DL, E@6 plain, S@7 START
    const r = validatePlacement(empty, placements)
    if (!r.ok) throw new Error('invalid')
    // J 9*3=27, O 1, K 6*2=12, E 1, S 1 => 42, x2 = 84
    expect(scorePlay(empty, placements, r.words).total).toBe(84)
  })
  it('premiums count only on newly placed tiles', () => {
    const board = play(empty, word('JOKES', 7, 3))
    const placements = word('A', 6, 3) // above J: forms "AJ" vertically; (6,3) is plain
    const r = validatePlacement(board, placements)
    if (!r.ok) throw new Error('invalid')
    // AJ: A1 + J9 (TL not re-applied) = 10
    expect(scorePlay(board, placements, r.words).total).toBe(10)
  })
  it('multiplies stacked word premiums', () => {
    // Vertical along column 3: 3W at (3,3)? 3W is (a,b)=(4,7): (0,3)/(3,0) -> row 3 col 0 style. Use column 0, rows 3..10 not reachable.
    // Instead build via a board with tiles placed directly and score a word through two DW squares: row 1, cols 1.. (a=6,b=6 TL) -> use (2,5)=DW at (2,2)?
    // Directly craft: DW squares at (7,1) and (7,13) [a=0,b=6]; a 13-letter word is impractical, so test TW x DW via a prepared board.
    const board = createBoard()
    // Column 0: 3W at rows 3 and 11 (a=4... col 0 -> dc=7, row 3 -> dr=4). Fill rows 4..10 of column 0 with existing tiles.
    for (let r = 4; r <= 10; r++) board[r][0] = { tile: tile('A'), letter: 'A' }
    const placements: Placement[] = [
      { row: 3, col: 0, tile: tile('Q'), letter: 'Q' },
      { row: 11, col: 0, tile: tile('Z'), letter: 'Z' }
    ]
    const r = validatePlacement(board, placements)
    if (!r.ok) throw new Error('invalid: ' + JSON.stringify(r))
    // Q10 + 7*A(1) + Z10 = 27, x3 x3 = 243
    expect(scorePlay(board, placements, r.words).total).toBe(243)
  })
  it('blank scores 0 but still triggers word premiums', () => {
    const placements = word('JOKES', 7, 3, true, [0, 2]) // J and K are blanks
    const r = validatePlacement(empty, placements)
    if (!r.ok) throw new Error('invalid')
    // J0 O1 K0 E1 S1 = 3, x2 = 6
    expect(scorePlay(empty, placements, r.words).total).toBe(6)
    // a blank sitting on the star still doubles the word
    const onStar = word('JOKES', 7, 3, true, [4])
    const r2 = validatePlacement(empty, onStar)
    if (!r2.ok) throw new Error('invalid')
    // J27 O1 K12 E1 S0 = 41, x2 = 82
    expect(scorePlay(empty, onStar, r2.words).total).toBe(82)
  })
  it('scores every word formed, counting new-tile premiums in cross words', () => {
    const board = play(empty, word('CAT', 7, 6))
    const placements = word('AT', 8, 6)
    const r = validatePlacement(board, placements)
    if (!r.ok) throw new Error('invalid')
    const s = scorePlay(board, placements, r.words)
    // Words: AT (8,6)-(8,7) = 2, CA (7,6)-(8,6) = 3+1 = 4, AT (7,7)-(8,7) = 1+1 = 2 => 8 (no premiums at (8,6),(8,7))
    expect(s.words).toHaveLength(3)
    expect(s.total).toBe(8)
  })
})

describe('placement hardening', () => {
  const empty = createBoard()
  it('rejects a normal tile played as another letter, reused tiles and fractional squares', () => {
    const a1 = tile('A')
    const a2 = tile('A')
    const wrong: Placement[] = [
      { row: 7, col: 7, tile: a1, letter: 'Z' },
      { row: 7, col: 8, tile: a2, letter: 'A' }
    ]
    expect(validatePlacement(empty, wrong)).toEqual({ ok: false, error: 'tile-mismatch' })
    const reused: Placement[] = [
      { row: 7, col: 7, tile: a1, letter: 'A' },
      { row: 7, col: 8, tile: a1, letter: 'A' }
    ]
    expect(validatePlacement(empty, reused)).toEqual({ ok: false, error: 'duplicate-tile' })
    expect(validatePlacement(empty, [{ row: 7.5, col: 7, tile: a1, letter: 'A' }])).toEqual({
      ok: false, error: 'out-of-bounds'
    })
  })
  it('reports a premium square once even when it forms two words', () => {
    const board = play(empty, word('CAT', 7, 5)) // C(7,5) A(7,6) T(7,7)
    // (6,5)? choose a DL square forming two words: place tiles so one new tile has both-direction words.
    const placements: Placement[] = [
      { row: 8, col: 5, tile: tile('A'), letter: 'A' },
      { row: 8, col: 6, tile: tile('T'), letter: 'T' }
    ]
    const r = validatePlacement(board, placements)
    if (!r.ok) throw new Error('invalid')
    const hits = scorePlay(board, placements, r.words).premiumsHit
    expect(hits.length).toBe(new Set(placements.map((p) => `${p.row},${p.col}`)).size -
      placements.filter((p) => PREMIUM_LAYOUT[p.row][p.col] === 'NONE').length)
  })
})

describe('rumble bonus', () => {
  it('adds 50 for a seven-tile play and not for six', () => {
    const empty = createBoard()
    const seven = word('QUARTZY', 7, 1)
    const r7 = validatePlacement(empty, seven)
    if (!r7.ok) throw new Error('invalid')
    const s7 = scorePlay(empty, seven, r7.words)
    expect(s7.rumble).toBe(true)
    expect(s7.rumbleBonus).toBe(50)

    const six = word('QUARTZ', 7, 2)
    const r6 = validatePlacement(empty, six)
    if (!r6.ok) throw new Error('invalid')
    const s6 = scorePlay(empty, six, r6.words)
    expect(s6.rumble).toBe(false)
    expect(s6.total).toBe(s6.words[0].score)
  })
})
