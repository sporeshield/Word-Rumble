import { describe, expect, it } from 'vitest'
import { levelGain, matchingSounds, pickSound, voicedName } from './sfx'

const names = ['burst-zap-1', 'burst-zap-2', 'burst-pow-1', 'ui-click', 'burstly']

describe('sound names', () => {
  it('matches groups by dash prefix only', () => {
    expect(matchingSounds(names, 'burst')).toEqual(['burst-zap-1', 'burst-zap-2', 'burst-pow-1'])
    expect(matchingSounds(names, 'burst-zap')).toEqual(['burst-zap-1', 'burst-zap-2'])
  })
  it('prefers an exact name, picks a group member otherwise, null when unknown', () => {
    expect(pickSound(names, 'ui-click')).toBe('ui-click')
    expect(pickSound(names, 'burst-pow', () => 0.9)).toBe('burst-pow-1')
    expect(pickSound(names, 'burst', () => 0.99)).toBe('burst-pow-1')
    expect(pickSound(names, 'nope')).toBeNull()
  })
})

describe('voiced sounds', () => {
  const have = new Set(['count-3', 'male-count-3', 'ui-click'])
  it('swaps in the male set, silences when off, leaves other sounds alone', () => {
    expect(voicedName('count-3', 'female', have)).toBe('count-3')
    expect(voicedName('count-3', 'male', have)).toBe('male-count-3')
    expect(voicedName('count-3', 'off', have)).toBeNull()
    expect(voicedName('ui-click', 'off', have)).toBe('ui-click')
    expect(voicedName('voice-power-up', 'male', have)).toBe('voice-power-up')
  })
})

describe('level matching', () => {
  it('turns dB into a linear gain and leaves unknown names alone', () => {
    expect(levelGain('a', { a: { gainDb: -6.02 } })).toBeCloseTo(0.5, 2)
    expect(levelGain('a', { a: { gainDb: 0 } })).toBe(1)
    expect(levelGain('nope', {})).toBe(1)
  })
  it('has a gain that never clips for every measured sound', async () => {
    const table = (await import('./levels.json')).default as Record<string, { gainDb: number; peakDb: number }>
    for (const [name, e] of Object.entries(table)) expect(e.peakDb + e.gainDb, name).toBeLessThanOrEqual(-0.9)
  })
})
