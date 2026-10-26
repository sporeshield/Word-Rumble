import { describe, expect, it } from 'vitest'
import { ANNOY_COUNT, createAnnoyDeck, drawAnnoy } from './annoy'

describe('annoying power-sound deck', () => {
  it('uses every sound once before any repeats', () => {
    let deck = createAnnoyDeck()
    const seen: string[] = []
    let last: number | null = null
    for (let i = 0; i < ANNOY_COUNT; i++) {
      const d = drawAnnoy(deck, 1, last)
      seen.push(...d.sounds)
      deck = d.deck
      last = d.last
    }
    expect(new Set(seen).size).toBe(ANNOY_COUNT)
  })

  it('never repeats the previous sound, even across a refill', () => {
    let deck: number[] = []
    let last: number | null = null
    let prev = ''
    for (let i = 0; i < 400; i++) {
      const d = drawAnnoy(deck, 1, last)
      expect(d.sounds[0]).not.toBe(prev)
      prev = d.sounds[0]
      deck = d.deck
      last = d.last
    }
  })

  it('chains two different sounds and survives a missing deck', () => {
    const d = drawAnnoy(undefined as unknown as number[], 2, null)
    expect(d.sounds).toHaveLength(2)
    expect(d.sounds[0]).not.toBe(d.sounds[1])
  })
})
