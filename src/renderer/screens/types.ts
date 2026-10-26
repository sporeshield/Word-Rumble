import type { CostMode, GameMode, HintMode, MadeUpMode } from '../engine/game'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type RackSide = 'left' | 'right'

/** Everything the Setup screen collects. */
export interface SetupConfig {
  mode: GameMode
  difficulty: Difficulty
  /** How many play in Friends mode (`mode: 'two'`); solo and computer ignore it. */
  players: PlayerCount
  /** Always four names; solo uses the first, computer mode the first (the human), Friends the first `players`. */
  names: string[]
  /** Always four distinct CSS colours, one per seat (rack holder and tile underline). */
  colors: string[]
  /** Seconds per turn, or null for no timer. */
  timerSeconds: number | null
  hints: HintMode
  madeUp: MadeUpMode
  /** Shuffle and Swap: free, or a random 1–10 point cost quoted first. */
  shuffle: CostMode
  swap: CostMode
  /** Which side of the board the upright rack stands on (whole game, not per player). */
  rackSide: RackSide
}

export type PlayerCount = 2 | 3 | 4
export const MAX_PLAYERS = 4

export const COLOR_CHOICES = ['#1cc5b4', '#9361e9', '#ff8a2a', '#ff81ba', '#3772ff', '#e4b400'] as const
/** Seat colours: teal, violet, orange, pink. */
export const DEFAULT_COLORS: readonly string[] = ['#1cc5b4', '#9361e9', '#ff8a2a', '#ff81ba']
/** The computer plays in orange (pink if the human picked orange). */
export const COMPUTER_COLOR = '#ff8a2a'
export const computerColor = (human: string) => (human === COMPUTER_COLOR ? '#ff81ba' : COMPUTER_COLOR)

export const DEFAULT_SETUP: SetupConfig = {
  mode: 'two',
  difficulty: 'medium',
  players: 2,
  names: ['Shane', 'Dawn', 'Player 3', 'Player 4'],
  colors: [...DEFAULT_COLORS],
  timerSeconds: null,
  hints: 'penalty',
  madeUp: 'penalty',
  shuffle: 'penalty',
  swap: 'penalty',
  rackSide: 'left'
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

/** Seats in play: solo 1, computer 2, Friends 2–4. */
export function seatCount(config: Pick<SetupConfig, 'mode' | 'players'>): number {
  return config.mode === 'solo' ? 1 : config.mode === 'computer' ? 2 : config.players
}

/** Names the game is created with: solo → 1, computer → human + "Computer", Friends → 2–4 (duplicates numbered). */
export function playerNames(config: SetupConfig, defaults: readonly string[] = FACTORY_NAMES): string[] {
  const name = (i: number) => config.names[i]?.trim() || defaults[i] || `Player ${i + 1}`
  if (config.mode === 'solo') return [name(0)]
  if (config.mode === 'computer') return [name(0), 'Computer']
  const names: string[] = []
  for (let i = 0; i < config.players; i++) {
    const base = name(i)
    let candidate = base
    for (let n = 2; names.some((taken) => taken.toLowerCase() === candidate.toLowerCase()); n++) candidate = `${base} ${n}`
    names.push(candidate)
  }
  return names
}

/** Colours for the seats in play (computer mode: the computer is always orange). */
export function seatColors(config: SetupConfig): string[] {
  if (config.mode === 'computer') return [config.colors[0], computerColor(config.colors[0])]
  return config.colors.slice(0, seatCount(config))
}

/** Give seat `index` a colour; whoever had it already takes the old colour, so no two seats match. */
export function swapColor(colors: readonly string[], index: number, color: string): string[] {
  const next = [...colors]
  const other = next.indexOf(color)
  if (other !== -1 && other !== index) next[other] = next[index]
  next[index] = color
  return next
}

/** Four distinct colours from a stored list: unknown or repeated entries get the first free default. */
function cleanColors(stored: unknown): string[] {
  const list = Array.isArray(stored) ? stored : []
  const out: string[] = []
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const v = list[i]
    const ok = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && !out.includes(v)
    out.push(ok ? v : '')
  }
  const spare = [...DEFAULT_COLORS, ...COLOR_CHOICES].filter((c) => !out.includes(c))
  return out.map((c) => c || spare.shift()!)
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
    // Older setups stored two names/colours and no player count: they upgrade to a two-player table.
    players: pick(s.players, [2, 3, 4], DEFAULT_SETUP.players),
    names: FACTORY_NAMES.map((_, i) => str(Array.isArray(s.names) ? s.names[i] : undefined, defaults[i] ?? FACTORY_NAMES[i])),
    colors: cleanColors(s.colors),
    timerSeconds: clampTimer(typeof s.timerSeconds === 'number' ? s.timerSeconds : null),
    hints: pick(s.hints, ['off', 'free', 'penalty'], DEFAULT_SETUP.hints),
    madeUp: pick(s.madeUp, ['no', 'free', 'penalty'], DEFAULT_SETUP.madeUp),
    shuffle: pick(s.shuffle, ['free', 'penalty'], DEFAULT_SETUP.shuffle),
    swap: pick(s.swap, ['free', 'penalty'], DEFAULT_SETUP.swap),
    rackSide: pick(s.rackSide, ['left', 'right'], DEFAULT_SETUP.rackSide)
  }
}
