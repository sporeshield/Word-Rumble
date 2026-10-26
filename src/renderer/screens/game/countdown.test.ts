import { describe, expect, it } from 'vitest'
import { countdownStage } from './countdown'

describe('countdownStage', () => {
  it('is calm above 10 seconds', () => {
    expect(countdownStage(11)).toEqual({ kind: 'calm' })
    expect(countdownStage(90)).toEqual({ kind: 'calm' })
  })
  it('turns nervous at 10 and rises to level 10 at 1', () => {
    expect(countdownStage(10)).toMatchObject({ kind: 'nervous', level: 1, voiceSound: 'count-10', heartbeatRate: 1 })
    const last = countdownStage(1)
    expect(last).toMatchObject({ kind: 'nervous', level: 10, voiceSound: 'count-1' })
    if (last.kind === 'nervous') expect(last.heartbeatRate).toBeCloseTo(1.4)
  })
  it('booms at 0 and below', () => {
    expect(countdownStage(0)).toEqual({ kind: 'boom' })
    expect(countdownStage(-1)).toEqual({ kind: 'boom' })
  })
})
