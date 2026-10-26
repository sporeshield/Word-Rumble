import { describe, expect, it } from 'vitest'
import { formatNotebookDate, parseRecentPlayers, penaltyLabel, tallyGroups } from './notebook-format'

describe('notebook formatting', () => {
  it('formats dates and handles missing dates', () => {
    expect(formatNotebookDate('2026-10-25T12:00:00Z')).toBe('25 Oct 2026')
    expect(formatNotebookDate('bad')).toBe('Date unknown')
    expect(formatNotebookDate(null)).toBe('Date unknown')
  })

  it('parses players from the right so names can contain colons', () => {
    expect(parseRecentPlayers('Sam:the:Great:42:1|Dawn:-3:0')).toEqual([
      { name: 'Sam:the:Great', score: 42, winner: true },
      { name: 'Dawn', score: -3, winner: false }
    ])
    expect(parseRecentPlayers('Broken|Someone:nope:1|Sam:9:2')).toEqual([])
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
})
