import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUP, clampTimer, loadDefaultNames, loadSetup, playerNames, seatColors, seatCount, swapColor } from './types'

describe('setup helpers', () => {
  it('names players per mode and defaults blanks', () => {
    expect(playerNames(DEFAULT_SETUP)).toEqual(['Player 1', 'Player 2'])
    expect(playerNames({ ...DEFAULT_SETUP, mode: 'solo' })).toEqual(['Player 1'])
    expect(playerNames({ ...DEFAULT_SETUP, mode: 'computer', names: ['  ', 'x'] })).toEqual(['Player 1', 'Computer'])
    expect(playerNames({ ...DEFAULT_SETUP, names: ['Sam', 'Sam'] })).toEqual(['Sam', 'Sam 2'])
  })
  it('names 3 and 4 Friends players, numbering repeats', () => {
    expect(playerNames({ ...DEFAULT_SETUP, players: 3 })).toEqual(['Player 1', 'Player 2', 'Player 3'])
    expect(playerNames({ ...DEFAULT_SETUP, players: 4, names: ['Al', 'al', ' ', 'Al'] })).toEqual(['Al', 'al 2', 'Player 3', 'Al 3'])
    expect(playerNames({ ...DEFAULT_SETUP, mode: 'computer', players: 4 })).toEqual(['Player 1', 'Computer'])
  })
  it('counts seats and their colours', () => {
    expect(seatCount({ mode: 'solo', players: 4 })).toBe(1)
    expect(seatCount({ mode: 'computer', players: 4 })).toBe(2)
    expect(seatCount({ mode: 'two', players: 3 })).toBe(3)
    expect(seatColors({ ...DEFAULT_SETUP, players: 4 })).toEqual(['#1cc5b4', '#9361e9', '#ff8a2a', '#ff81ba'])
    expect(seatColors({ ...DEFAULT_SETUP, mode: 'computer', colors: ['#3772ff', '#9361e9', '#ff8a2a', '#ff81ba'] })).toEqual(['#3772ff', '#ff8a2a'])
  })
  it('swaps colours so no two seats share one', () => {
    const colors = ['#1cc5b4', '#9361e9', '#ff8a2a', '#ff81ba']
    expect(swapColor(colors, 0, '#ff81ba')).toEqual(['#ff81ba', '#9361e9', '#ff8a2a', '#1cc5b4'])
    expect(swapColor(colors, 2, '#3772ff')).toEqual(['#1cc5b4', '#9361e9', '#3772ff', '#ff81ba'])
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
    expect(s.names).toEqual(['Al', 'Player 2', 'Player 3', 'Player 4'])
    expect(loadSetup({ players: 7 }).players).toBe(2)
    expect(loadSetup({ players: 4 }).players).toBe(4)
  })
  it('upgrades an old two-seat setup to four names and four distinct colours', () => {
    const old = loadSetup({ mode: 'two', names: ['Tess', 'Blair'], colors: ['#9361e9', '#1cc5b4'] })
    expect(old.players).toBe(2)
    expect(old.names).toEqual(['Tess', 'Blair', 'Player 3', 'Player 4'])
    expect(old.colors).toEqual(['#9361e9', '#1cc5b4', '#ff8a2a', '#ff81ba'])
    const messy = loadSetup({ colors: ['#ff8a2a', '#ff8a2a', 'red', 7] })
    expect(new Set(messy.colors).size).toBe(4)
    expect(messy.colors[0]).toBe('#ff8a2a')
  })
})

describe('default names', () => {
  it('fills missing or blank names from the factory list', () => {
    expect(loadDefaultNames(undefined)).toEqual(['Player 1', 'Player 2', 'Player 3', 'Player 4'])
    expect(loadDefaultNames(['Mum', '  ', 7])).toEqual(['Mum', 'Player 2', 'Player 3', 'Player 4'])
  })
  it('uses the saved defaults for blank setup names', () => {
    const defaults = ['Mum', 'Dad', 'A', 'B']
    expect(playerNames({ ...DEFAULT_SETUP, names: ['', ''] }, defaults)).toEqual(['Mum', 'Dad'])
    expect(loadSetup({}, defaults).names).toEqual(['Mum', 'Dad', 'A', 'B'])
  })
})

describe('Wild board setup', () => {
  it('defaults to Classic with the default power counts', () => {
    const s = loadSetup({})
    expect(s.board).toBe('classic')
    expect(s.power).toEqual({ pl5: 2, pl10: 2, qw: 1, pw5: 2, pw10: 2 })
  })
  it('keeps saved counts, clamped to 0–4, and ignores a bad board value', () => {
    const s = loadSetup({ board: 'wild', power: { pl5: 9, pl10: -3, qw: 3 } })
    expect(s.board).toBe('wild')
    expect(s.power).toEqual({ pl5: 4, pl10: 0, qw: 3, pw5: 0, pw10: 0 })
    expect(loadSetup({ board: 'huge' }).board).toBe('classic')
  })
})
