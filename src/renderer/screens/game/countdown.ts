/** What the turn timer should look and sound like with `seconds` left. Pure, so the rules are testable. */
export type CountdownStage =
  | { kind: 'calm' }
  | { kind: 'nervous'; level: number; heartbeatRate: number; voiceSound: string }
  | { kind: 'boom' }

export const NERVOUS_FROM = 10

export function countdownStage(seconds: number): CountdownStage {
  if (seconds <= 0) return { kind: 'boom' }
  if (seconds > NERVOUS_FROM) return { kind: 'calm' }
  // Level 1 at 10 s left … level 10 at 1 s left; the heartbeat speeds up from 1.0 to 1.4.
  const level = NERVOUS_FROM + 1 - seconds
  return { kind: 'nervous', level, heartbeatRate: 1 + ((level - 1) / (NERVOUS_FROM - 1)) * 0.4, voiceSound: `count-${seconds}` }
}
