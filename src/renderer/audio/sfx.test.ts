import { describe, expect, it } from 'vitest'
import { matchingSounds, pickSound } from './sfx'

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
