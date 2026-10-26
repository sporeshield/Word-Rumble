import { describe, expect, it } from 'vitest'
import { dropNote, formatNotebookDate, placeLabel, penaltyLabel, recentHeadline, recentPlayers, tallyGroups } from './notebook-format'

describe('notebook formatting', () => {
  it('formats dates and handles missing dates', () => {
    expect(formatNotebookDate('2026-10-25T12:00:00Z')).toBe('25 Oct 2026')
    expect(formatNotebookDate('bad')).toBe('Date unknown')
    expect(formatNotebookDate(null)).toBe('Date unknown')
  })

  it('reads structured Recent Games players and drops malformed ones', () => {
    const sam = { name: 'Sam|the:Great', isComputer: false, score: 42, rank: 1, winner: true, conceded: false, givenAway: 0, giftTo: null }
    expect(recentPlayers([sam, { name: 'Blair', score: -3, rank: 2 }, { name: '', score: 1, rank: 3 }, null, { name: 'X', score: 'no', rank: 1 }])).toEqual([
      sam,
      { name: 'Blair', isComputer: false, score: -3, rank: 2, winner: false, conceded: false, givenAway: 0, giftTo: null }
    ])
    expect(recentPlayers('Sam:42:1')).toEqual([])
  })

  it('heads a recent game by its places', () => {
    const p = (name: string, rank: number) => ({ name, rank, score: 0, isComputer: false, winner: false, conceded: false, givenAway: 0, giftTo: null })
    expect(recentHeadline([p('Tess', 1)])).toBe("Tess's run")
    expect(recentHeadline([p('Blair', 1), p('Tess', 2), p('Pip', 3)])).toBe('Blair won')
    expect(recentHeadline([p('Blair', 1), p('Tess', 1), p('Pip', 3)])).toBe('Blair & Tess tied')
    expect(recentHeadline([p('Blair', 1), p('Tess', 1)])).toBe("It's a draw!")
  })

  it('labels every wheel outcome', () => {
    expect(['half', 'zero', 'minus10', 'minus20', 'gift', 'skip', 'rackwipe', 'convince', 'lucky', null].map(penaltyLabel)).toEqual([
      'Half points', 'Zero points', '−10 points', '−20 points', 'Gift to opponent',
      'Skip a turn', 'Rack wipe', 'Convince them!', 'Lucky escape', 'No penalty'
    ])
  })

  it('groups tally marks in fives', () => {
    expect(tallyGroups(12)).toEqual([5, 5, 2])
    expect(tallyGroups(5)).toEqual([5])
    expect(tallyGroups(0)).toEqual([])
    expect(tallyGroups(null)).toEqual([])
  })

  it('names places and drop-outs', () => {
    expect([1, 2, 3, 4].map(placeLabel)).toEqual(['1st', '2nd', '3rd', '4th'])
    const base = { name: 'Mo', isComputer: false, score: 0, rank: 4, winner: false, conceded: true, givenAway: 42, giftTo: 'Blair' }
    expect(dropNote(base)).toBe('dropped out — gave 42 to Blair')
    expect(dropNote({ ...base, givenAway: 0, giftTo: null })).toBe('dropped out')
    expect(dropNote({ ...base, conceded: false })).toBe('')
  })
})
