import type { Tile } from './types'

/** Uniform random integer in [0, max) from crypto, using rejection sampling (no modulo bias). */
export function randomInt(max: number): number {
  if (max <= 0) throw new RangeError('max must be positive')
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

/** Fisher-Yates shuffle with crypto randomness. Returns a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/** Create a shuffled bag from a tile list. */
export const createBag = (tiles: readonly Tile[]): Tile[] => shuffle(tiles)

/** Draw up to `count` tiles from the end of the bag (pure: returns drawn tiles and the remaining bag). */
export function drawTiles(bag: readonly Tile[], count: number): { drawn: Tile[]; bag: Tile[] } {
  const n = Math.min(count, bag.length)
  return { drawn: bag.slice(bag.length - n), bag: bag.slice(0, bag.length - n) }
}

/** Put tiles back into the bag and reshuffle. */
export const returnTiles = (bag: readonly Tile[], tiles: readonly Tile[]): Tile[] => shuffle([...bag, ...tiles])
