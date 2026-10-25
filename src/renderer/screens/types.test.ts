import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUP, clampTimer, loadSetup, playerNames } from './types'

describe('setup helpers', () => {
  it('names players per mode and defaults blanks', () => {
    expect(playerNames(DEFAULT_SETUP)).toEqual(['Shane', 'Dawn'])
    expect(playerNames({ ...DEFAULT_SETUP, mode: 'solo' })).toEqual(['Shane'])
    expect(playerNames({ ...DEFAULT_SETUP, mode: 'computer', names: ['  ', 'x'] })).toEqual(['Shane', 'Computer'])
    expect(playerNames({ ...DEFAULT_SETUP, names: ['Sam', 'Sam'] })).toEqual(['Sam', 'Sam 2'])
  })
  it('clamps the custom timer', () => {
    expect(clampTimer(5)).toBe(15)
    expect(clampTimer(9999)).toBe(600)
    expect(clampTimer(null)).toBeNull()
  })
  it('loads stored setup defensively', () => {
    expect(loadSetup(undefined)).toEqual(DEFAULT_SETUP)
    expect(loadSetup({ mode: 'bogus' }).mode).toBe('two')
    const s = loadSetup({ hints: 'free', timerSeconds: 90, names: ['Al'] })
    expect(s.hints).toBe('free')
    expect(s.timerSeconds).toBe(90)
    expect(s.names).toEqual(['Al', 'Dawn'])
  })
})
