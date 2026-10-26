import { randomInt } from './bag'
import { PREMIUM_LAYOUT } from './board'
import { BOARD_SIZE, CENTER, type Premium } from './types'

/** How many of each Wild power square a game has (0–4 each). */
export interface PowerCounts {
  pl5: number
  pl10: number
  qw: number
  pw5: number
  pw10: number
}

export type PowerKind = keyof PowerCounts

export const POWER_MAX = 4
export const POWER_KINDS: readonly PowerKind[] = ['pl5', 'pl10', 'qw', 'pw5', 'pw10']
export const POWER_PREMIUM: Record<PowerKind, Premium> = { pl5: 'PL5', pl10: 'PL10', qw: 'QW', pw5: 'PW5', pw10: 'PW10' }
export const DEFAULT_POWER: PowerCounts = { pl5: 2, pl10: 2, qw: 1, pw5: 2, pw10: 2 }
export const NO_POWER: PowerCounts = { pl5: 0, pl10: 0, qw: 0, pw5: 0, pw10: 0 }

export const isPowerPremium = (p: Premium): boolean => p === 'PL5' || p === 'PL10' || p === 'QW' || p === 'PW5' || p === 'PW10'

const clampCount = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(POWER_MAX, Math.round(n))) : 0

/** Clean up counts from a save or setup: whole numbers 0–4, missing kinds = 0. */
export const normalisePower = (power: Partial<PowerCounts> | null | undefined): PowerCounts => ({
  pl5: clampCount(power?.pl5), pl10: clampCount(power?.pl10), qw: clampCount(power?.qw),
  pw5: clampCount(power?.pw5), pw10: clampCount(power?.pw10)
})

export const powerTotal = (power: PowerCounts): number => POWER_KINDS.reduce((sum, k) => sum + power[k], 0)

/** Random counts for "Surprise me". */
export const randomPower = (rand: (max: number) => number = randomInt): PowerCounts =>
  normalisePower(Object.fromEntries(POWER_KINDS.map((k) => [k, rand(POWER_MAX + 1)])))

const quadrant = (row: number, col: number): number => (row <= CENTER ? 0 : 2) + (col <= CENTER ? 0 : 1)

/**
 * The Classic layout plus the chosen power squares on random plain squares.
 * Dealt round-robin across the four quadrants; never the centre or beside it; no two power squares touching;
 * no two of one type in a row or column. If that cannot be met it relaxes touching first, then row/column.
 * `rand(max)` returns an integer in [0, max) (crypto by default; tests pass a seeded one).
 */
export function buildLayout(power: PowerCounts, rand: (max: number) => number = randomInt): Premium[][] {
  const counts = normalisePower(power)
  const layout = PREMIUM_LAYOUT.map((row) => row.slice())
  const wanted: PowerKind[] = []
  for (const kind of POWER_KINDS) for (let i = 0; i < counts[kind]; i++) wanted.push(kind)
  // Shuffle so the quadrant dealing is not the same type pattern every game.
  for (let i = wanted.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[wanted[i], wanted[j]] = [wanted[j], wanted[i]]
  }

  const free: [number, number][] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (PREMIUM_LAYOUT[r][c] === 'NONE' && Math.max(Math.abs(r - CENTER), Math.abs(c - CENTER)) > 1) free.push([r, c])
    }
  }

  const kindAt = new Map<string, PowerKind>()
  const touches = (r: number, c: number): boolean => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && kindAt.has(`${r + dr},${c + dc}`)) return true
    return false
  }
  const sameLine = (r: number, c: number, kind: PowerKind): boolean => {
    for (const [key, k] of kindAt) {
      if (k !== kind) continue
      const [pr, pc] = key.split(',').map(Number)
      if (pr === r || pc === c) return true
    }
    return false
  }

  const offset = rand(4)
  wanted.forEach((kind, i) => {
    const home = (offset + i) % 4
    const open = free.filter(([r, c]) => !kindAt.has(`${r},${c}`))
    // Prefer the home quadrant, then anywhere; within each, strictest rules first.
    const pick = (inHome: boolean): [number, number][] => {
      for (const level of [0, 1, 2]) {
        const ok = open.filter(([r, c]) =>
          (!inHome || quadrant(r, c) === home) && (level >= 1 || !touches(r, c)) && (level >= 2 || !sameLine(r, c, kind)))
        if (ok.length) return ok
      }
      return []
    }
    const options = pick(true).length ? pick(true) : pick(false)
    if (!options.length) return
    const [r, c] = options[rand(options.length)]
    kindAt.set(`${r},${c}`, kind)
    layout[r][c] = POWER_PREMIUM[kind]
  })
  return layout
}
