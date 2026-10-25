import { applyPlacements, BOARD_SIZE, CENTER, inBounds, isBoardEmpty, scorePlay, validatePlacement } from '../engine'
import type { Board, FormedWord, Placement, PlayScore, Tile } from '../engine'
import type { Trie } from './trie'

export interface Move {
  placements: Placement[]
  words: FormedWord[]
  score: PlayScore
}

const ALL_LETTERS = (1 << 26) - 1

interface Placed {
  tile: Tile
  letter: string
  col: number
}

/**
 * Every legal move for `rack` on `board` (Appel-Jacobson anchor search, run once per axis).
 * Words are checked against `trie`; geometry, words and scores come from the engine so
 * a generated move is always one the game would accept. Sorted best score first.
 */
export function generateMoves(board: Board, rack: Tile[], trie: Trie): Move[] {
  const empty = isBoardEmpty(board)
  const found = new Map<string, Move>()

  for (const horizontal of [true, false]) {
    const get = (i: number, j: number): string | null => {
      if (!inBounds(i, j)) return null
      return (horizontal ? board[i][j] : board[j][i])?.letter ?? null
    }
    const toPlacement = (i: number, p: Placed): Placement => ({
      row: horizontal ? i : p.col,
      col: horizontal ? p.col : i,
      tile: p.tile,
      letter: p.letter
    })

    const isAnchor = (i: number, j: number): boolean => {
      if (get(i, j) !== null) return false
      if (empty) return i === CENTER && j === CENTER
      return get(i - 1, j) !== null || get(i + 1, j) !== null || get(i, j - 1) !== null || get(i, j + 1) !== null
    }

    // Letters allowed on (i,j) so the perpendicular word, if any, is valid.
    const crossCache = new Map<number, number>()
    const crossMask = (i: number, j: number): number => {
      const key = i * BOARD_SIZE + j
      const cached = crossCache.get(key)
      if (cached !== undefined) return cached
      let up = ''
      for (let r = i - 1; get(r, j) !== null; r--) up = get(r, j)! + up
      let down = ''
      for (let r = i + 1; get(r, j) !== null; r++) down += get(r, j)!
      let mask = ALL_LETTERS
      if (up || down) {
        mask = 0
        for (let code = 0; code < 26; code++) {
          if (trie.has(up + String.fromCharCode(65 + code) + down)) mask |= 1 << code
        }
      }
      crossCache.set(key, mask)
      return mask
    }

    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (!isAnchor(i, j)) continue
        const anchor = j

        const record = (placed: Placed[]): void => {
          if (empty && placed.length < 2) return
          const placements = placed.map((p) => toPlacement(i, p))
          const key = placements
            .map((p) => `${p.row},${p.col},${p.letter}${p.tile.letter === '?' ? '?' : ''}`)
            .sort()
            .join('|')
          if (found.has(key)) return
          const result = validatePlacement(board, placements)
          if (!result.ok) return
          found.set(key, { placements, words: result.words, score: scorePlay(board, placements, result.words) })
        }

        const used = new Array<boolean>(rack.length).fill(false)

        // Try each distinct rack tile (one per letter) that fits `node`, via `mask`.
        const forEachTile = (node: number, mask: number, fn: (idx: number, letter: string, child: number) => void): void => {
          const tried = new Set<string>()
          for (let t = 0; t < rack.length; t++) {
            if (used[t] || tried.has(rack[t].letter)) continue
            tried.add(rack[t].letter)
            if (rack[t].letter === '?') {
              for (let c = trie.first(node); c >= 0; c = trie.next(c)) {
                const code = trie.letterOf(c)
                if (mask & (1 << code)) fn(t, String.fromCharCode(65 + code), c)
              }
            } else {
              const code = rack[t].letter.charCodeAt(0) - 65
              if (!(mask & (1 << code))) continue
              const child = trie.child(node, code)
              if (child >= 0) fn(t, rack[t].letter, child)
            }
          }
        }

        const extendRight = (node: number, col: number, placed: Placed[]): void => {
          const existing = col < BOARD_SIZE ? get(i, col) : null
          if (existing === null) {
            if (col > anchor && trie.isEnd(node)) record(placed)
            if (col >= BOARD_SIZE) return
            forEachTile(node, crossMask(i, col), (t, letter, child) => {
              used[t] = true
              placed.push({ tile: rack[t], letter, col })
              extendRight(child, col + 1, placed)
              placed.pop()
              used[t] = false
            })
          } else {
            const child = trie.child(node, existing.charCodeAt(0) - 65)
            if (child >= 0) extendRight(child, col + 1, placed)
          }
        }

        if (get(i, anchor - 1) !== null) {
          // Tiles already on the board form the start of the word.
          let start = anchor - 1
          while (get(i, start - 1) !== null) start--
          let node = trie.root
          for (let c = start; c < anchor && node >= 0; c++) node = trie.child(node, get(i, c)!.charCodeAt(0) - 65)
          if (node >= 0) extendRight(node, anchor, [])
        } else {
          let limit = 0
          while (anchor - 1 - limit >= 0 && !isAnchor(i, anchor - 1 - limit)) limit++
          const left: Omit<Placed, 'col'>[] = []
          const leftPart = (node: number): void => {
            const base = anchor - left.length
            extendRight(node, anchor, left.map((p, k) => ({ ...p, col: base + k })))
            if (left.length >= limit) return
            forEachTile(node, ALL_LETTERS, (t, letter, child) => {
              used[t] = true
              left.push({ tile: rack[t], letter })
              leftPart(child)
              left.pop()
              used[t] = false
            })
          }
          leftPart(trie.root)
        }
      }
    }
  }

  return [...found.values()].sort((a, b) => b.score.total - a.score.total)
}

/** The highest-scoring move, or null when there is none (the player should exchange or pass). */
export const bestMove = (board: Board, rack: Tile[], trie: Trie): Move | null =>
  generateMoves(board, rack, trie)[0] ?? null

/** Board after a move (handy for look-ahead and tests). */
export const boardAfter = (board: Board, move: Move): Board => applyPlacements(board, move.placements)
