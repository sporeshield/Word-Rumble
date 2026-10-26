// Types shared by main, preload and renderer (type-only: no runtime code here).
export type GameMode = 'solo' | 'two' | 'computer'
export type ScoreFilter = GameMode | 'all'

export interface GamePlayerRecord {
  name: string
  isComputer?: boolean
  finalScore: number
  preAdjustScore: number
  rumbles?: number
  hintsUsed?: number
  hintPointsLost?: number
  shufflePointsLost?: number
  swapPointsLost?: number
  madeUpCount?: number
  conceded?: boolean
  winner?: boolean
}

export interface PlayRecord {
  playerIndex: number
  words: string[]
  score: number
  rumble?: boolean
  madeUp?: boolean
  penalty?: string | null
}

export interface GameRecord {
  mode: GameMode
  difficulty?: string | null
  timer?: number | null
  options?: unknown
  endedReason: string
  playedAt?: string
  players: GamePlayerRecord[]
  plays?: PlayRecord[]
}

export type Row = Record<string, unknown>

export interface ShortcutStatus {
  /** False in dev runs - there is no exe to point at. */
  available: boolean
  /** A shortcut named "Word Rumble" exists on the desktop. */
  exists: boolean
  /** It exists but points at a different exe/folder than the one running now. */
  needsRepair: boolean
  /** The player said "don't ask again". */
  declined: boolean
}

export interface WordRumbleApi {
  words: {
    /** Words (lower-case) not in the list; empty means every word is valid. */
    check(words: string[]): Promise<string[]>
    /** Add a real word to the family list (saved to the DB). Returns false if it isn't plain a-z. */
    add(word: string): Promise<boolean>
    /** The whole dictionary (ENABLE + extras + custom) for the move-generator worker. */
    all(): Promise<string[]>
    /** Forget every word the family added (built-in words stay). */
    clearCustom(): Promise<void>
  }
  scores: {
    record(game: GameRecord): Promise<number>
    top(filter?: ScoreFilter, limit?: number): Promise<Row[]>
    headToHead(): Promise<Row[]>
    bestPlays(limit?: number): Promise<Row[]>
    recent(limit?: number): Promise<Row[]>
    hallOfShame(): Promise<{ madeUpWords: Row[]; penalties: Row[]; perPlayer: Row[] }>
    reset(): Promise<void>
  }
  savedGame: {
    /** JSON text of the autosave, or null. */
    load(): Promise<string | null>
    save(json: string): Promise<void>
    clear(): Promise<void>
  }
  settings: {
    get(): Promise<Record<string, unknown>>
    set(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<void>
  }
  /** Sound files for sfx.ts: built-in ones from resources/sounds, replaced by same-named files in sounds/custom. */
  sounds: {
    /** Sound names (file name without extension) with the file name to read. */
    list(): Promise<{ name: string; file: string; custom: boolean }[]>
    /** Raw bytes of one listed file, or null if it can't be read (caller falls back to the built-in). */
    read(file: string, custom: boolean): Promise<Uint8Array | null>
  }
  shortcut: {
    status(): Promise<ShortcutStatus>
    /** Create, or repair if it points somewhere else. */
    create(): Promise<boolean>
    decline(): Promise<void>
  }
  /** Opens the Merriam-Webster Scrabble page for `word` in the default browser. */
  openLookup(word: string): Promise<void>
  quit(): Promise<void>
}
