import type { Tile } from './types'

/** Word Rumble's own 108-tile set: letter -> [count, points]. '?' is the blank. */
export const TILE_DISTRIBUTION: Record<string, [count: number, points: number]> = {
  A: [9, 1], B: [2, 4], C: [3, 3], D: [5, 2], E: [13, 1], F: [2, 4], G: [3, 3],
  H: [4, 3], I: [8, 1], J: [1, 9], K: [1, 6], L: [5, 2], M: [3, 3], N: [6, 1],
  O: [8, 1], P: [2, 4], Q: [1, 10], R: [6, 1], S: [5, 1], T: [7, 1], U: [4, 2],
  V: [2, 5], W: [2, 4], X: [1, 8], Y: [2, 4], Z: [1, 10], '?': [2, 0]
}

export const TILE_POINTS: Record<string, number> = Object.fromEntries(
  Object.entries(TILE_DISTRIBUTION).map(([letter, [, points]]) => [letter, points])
)

/** A fresh, ordered set of 108 tiles with unique ids. */
export function createTileSet(): Tile[] {
  const tiles: Tile[] = []
  let id = 0
  for (const [letter, [count, points]] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) tiles.push({ id: id++, letter, points })
  }
  return tiles
}

export const rackValue = (rack: readonly Tile[]): number => rack.reduce((sum, t) => sum + t.points, 0)
