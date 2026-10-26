import type { GameMode, HintMode, MadeUpMode } from '../engine/game'

export type Difficulty = 'easy' | 'medium' | 'hard'

/** Everything the Setup screen collects. */
export interface SetupConfig {
  mode: GameMode
  difficulty: Difficulty
  /** [player 1, player 2]; solo uses only the first, computer mode uses the first (the human). */
  names: [string, string]
  /** CSS colours for each player's rack holder and tile underline. */
  colors: [string, string]
  /** Seconds per turn, or null for no timer. */
  timerSeconds: number | null
  hints: HintMode
  madeUp: MadeUpMode
}

export const COLOR_CHOICES = ['#1cc5b4', '#9361e9', '#ff8a2a', '#ff81ba', '#3772ff', '#e4b400'] as const

export const DEFAULT_SETUP: SetupConfig = {
  mode: 'two',
  difficulty: 'medium',
  names: ['Shane', 'Dawn'],
  colors: ['#1cc5b4', '#9361e9'],
  timerSeconds: null,
  hints: 'penalty',
  madeUp: 'penalty'
}

/** Factory default names for up to four players; Settings can change them (setting `defaultNames`). */
export const FACTORY_NAMES: readonly string[] = ['Shane', 'Dawn', 'Player 3', 'Player 4']

/** Merge a stored `defaultNames` setting over the factory names (always 4 usable names). */
export function loadDefaultNames(stored: unknown): string[] {
  const list = Array.isArray(stored) ? stored : []
  return FACTORY_NAMES.map((fallback, i) => {
    const v = list[i]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 16) : fallback
  })
}

export const TIMER_PRESETS = [30, 60, 120, 180, 300] as const
export const TIMER_MIN = 15
export const TIMER_MAX = 600

/** Names the game is created with: solo → 1, computer → human + "Computer", two → both. */
export function playerNames(config: SetupConfig, defaults: readonly string[] = FACTORY_NAMES): string[] {
  const first = config.names[0].trim() || defaults[0]
  const second = config.names[1].trim() || defaults[1]
  if (config.mode === 'solo') return [first]
  if (config.mode === 'computer') return [first, 'Computer']
  return [first, second === first ? `${second} 2` : second]
}

/** Keep a custom timer inside 15 s – 10 min; null stays null. */
export function clampTimer(seconds: number | null): number | null {
  if (seconds === null || !Number.isFinite(seconds)) return null
  return Math.min(TIMER_MAX, Math.max(TIMER_MIN, Math.round(seconds)))
}

/** Merge a stored (possibly stale or hand-edited) config over the defaults. */
export function loadSetup(stored: unknown, defaults: readonly string[] = FACTORY_NAMES): SetupConfig {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<SetupConfig>
  const pick = <T,>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.slice(0, 16) : fallback)
  return {
    mode: pick(s.mode, ['solo', 'two', 'computer'], DEFAULT_SETUP.mode),
    difficulty: pick(s.difficulty, ['easy', 'medium', 'hard'], DEFAULT_SETUP.difficulty),
    names: [str(s.names?.[0], defaults[0]), str(s.names?.[1], defaults[1])],
    colors: [str(s.colors?.[0], DEFAULT_SETUP.colors[0]), str(s.colors?.[1], DEFAULT_SETUP.colors[1])],
    timerSeconds: clampTimer(typeof s.timerSeconds === 'number' ? s.timerSeconds : null),
    hints: pick(s.hints, ['off', 'free', 'penalty'], DEFAULT_SETUP.hints),
    madeUp: pick(s.madeUp, ['no', 'free', 'penalty'], DEFAULT_SETUP.madeUp)
  }
}
