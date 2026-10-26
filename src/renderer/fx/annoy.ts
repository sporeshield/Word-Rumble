import { shuffle } from '../engine/bag'

/** The shared pool of loud, silly sounds (`power-annoy-1` … `-13`). Never tied to a power type. */
export const ANNOY_COUNT = 13

/** Unused pool numbers, in the order they will play. JSON-safe, kept in game state like the burst decks. */
export type AnnoyDeck = number[]

const fullPool = (): number[] => Array.from({ length: ANNOY_COUNT }, (_, i) => i + 1)

export const createAnnoyDeck = (): AnnoyDeck => shuffle(fullPool())

/** Clean a deck from a save: keep valid pool numbers, refill if it is missing or empty. */
export const upgradeAnnoyDeck = (deck: unknown): AnnoyDeck => {
  const list = Array.isArray(deck) ? deck.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= ANNOY_COUNT) : []
  return list.length ? list : createAnnoyDeck()
}

/**
 * Draw `count` sounds. No repeat until the pool is used up, and when it is refilled the first new sound is never
 * the one just played (`previous` is the last number played, kept in game state). Returns sound names for `sfx.play`.
 */
export function drawAnnoy(deck: AnnoyDeck, count: number, previous: number | null = null): { sounds: string[]; deck: AnnoyDeck; last: number | null } {
  let rest = (Array.isArray(deck) ? deck : []).filter((n) => Number.isInteger(n) && n >= 1 && n <= ANNOY_COUNT)
  const sounds: string[] = []
  let last: number | null = previous
  for (let i = 0; i < count; i++) {
    if (rest.length === 0) {
      rest = createAnnoyDeck()
      if (last !== null && rest[0] === last && rest.length > 1) rest = [...rest.slice(1), rest[0]]
    }
    last = rest[0]
    sounds.push(`power-annoy-${last}`)
    rest = rest.slice(1)
  }
  return { sounds, deck: rest, last }
}
