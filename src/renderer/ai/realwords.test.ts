/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { applyPlacements, createBoard, createTileSet, validatePlacement } from '../engine'
import type { Board, Tile } from '../engine'
import { generateMoves } from './movegen'
import { Trie } from './trie'

const words = [
  ...gunzipSync(readFileSync('resources/words/enable.txt.gz')).toString('utf8').split(/\s+/),
  ...readFileSync('resources/words/extras.txt', 'utf8').split(/\s+/)
].filter(Boolean)
const trie = new Trie(words)

describe('real word list', () => {
  it('loads the whole list', () => {
    expect(trie.has('QUIZ')).toBe(true)
    expect(trie.has('QI')).toBe(true)
    expect(trie.has('ZZZQ')).toBe(false)
  })

  it('plays whole games with the best move and only ever makes legal, dictionary-valid plays', () => {
    const tiles = createTileSet()
    // deterministic pseudo-shuffle
    let seed = 12345
    for (let i = tiles.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const j = seed % (i + 1)
      ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
    }
    const bag: Tile[] = tiles
    let board: Board = createBoard()
    let rack = bag.splice(0, 7)
    let turns = 0
    const slowest: number[] = []
    while (turns < 40) {
      const t0 = performance.now()
      const moves = generateMoves(board, rack, trie)
      slowest.push(performance.now() - t0)
      if (moves.length === 0) break
      const move = moves[0]
      const check = validatePlacement(board, move.placements)
      expect(check.ok).toBe(true)
      for (const w of move.words) expect(trie.has(w.text)).toBe(true)
      board = applyPlacements(board, move.placements)
      const usedIds = new Set(move.placements.map((p) => p.tile.id))
      rack = [...rack.filter((t) => !usedIds.has(t.id)), ...bag.splice(0, usedIds.size)]
      turns++
    }
    expect(turns).toBeGreaterThan(10)
    expect(Math.max(...slowest)).toBeLessThan(3000)
  })
})
