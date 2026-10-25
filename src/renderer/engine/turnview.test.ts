import { describe, expect, it } from 'vitest'
import { createBoard } from './board'
import { moveInList, orderRack, previewPlay, wordsToCheck } from './turnview'
import type { Placement, Tile } from './types'

const tile = (id: number, letter: string, points = 1): Tile => ({ id, letter, points })
const place = (row: number, col: number, t: Tile): Placement => ({ row, col, tile: t, letter: t.letter })

describe('previewPlay', () => {
  it('is empty with no tiles', () => {
    expect(previewPlay(createBoard(), [])).toEqual({ kind: 'empty' })
  })
  it('explains an illegal first move', () => {
    const r = previewPlay(createBoard(), [place(0, 0, tile(1, 'A')), place(0, 1, tile(2, 'T'))])
    expect(r).toEqual({ kind: 'invalid', error: 'first-move-center' })
  })
  it('scores a legal first word through the star', () => {
    const r = previewPlay(createBoard(), [place(7, 6, tile(1, 'C', 3)), place(7, 7, tile(2, 'A')), place(7, 8, tile(3, 'T'))])
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') {
      expect(wordsToCheck(r.words)).toEqual(['cat'])
      expect(r.score.total).toBeGreaterThan(0)
    }
  })
})

describe('rack order helpers', () => {
  const rack = [tile(1, 'A'), tile(2, 'B'), tile(3, 'C')]
  it('keeps the chosen order and appends new tiles', () => {
    expect(orderRack([3, 1], rack).map((t) => t.id)).toEqual([3, 1, 2])
    expect(orderRack([9, 2], rack).map((t) => t.id)).toEqual([2, 1, 3])
  })
  it('moves an item to its final index', () => {
    expect(moveInList([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    expect(moveInList([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3])
    expect(moveInList([1, 2, 3], 1, 99)).toEqual([1, 3, 2])
  })
})
