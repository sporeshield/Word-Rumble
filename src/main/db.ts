import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Database, SqlJsStatic } from 'sql.js'
import type { GameMode, ScoreFilter, GamePlayerRecord, PlayRecord, GameRecord } from '../shared/api'

/** Electron-free so it can be unit-tested; `index.ts` supplies the file path. */

export type { GameMode, ScoreFilter, GamePlayerRecord, PlayRecord, GameRecord }

type Row = Record<string, unknown>
type Param = string | number | null

const MIGRATIONS: string[] = [
  `CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, is_computer INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE games (
     id INTEGER PRIMARY KEY, mode TEXT NOT NULL, difficulty TEXT, timer INTEGER, options TEXT,
     ended_reason TEXT NOT NULL, played_at TEXT NOT NULL);
   CREATE TABLE game_players (
     id INTEGER PRIMARY KEY, game_id INTEGER NOT NULL REFERENCES games(id), player_id INTEGER NOT NULL REFERENCES players(id),
     seat INTEGER NOT NULL, final_score INTEGER NOT NULL, pre_adjust_score INTEGER NOT NULL,
     rumbles INTEGER NOT NULL DEFAULT 0, hints_used INTEGER NOT NULL DEFAULT 0, hint_points_lost INTEGER NOT NULL DEFAULT 0,
     made_up_count INTEGER NOT NULL DEFAULT 0, conceded INTEGER NOT NULL DEFAULT 0, winner INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE plays (
     id INTEGER PRIMARY KEY, game_id INTEGER NOT NULL REFERENCES games(id), player_id INTEGER NOT NULL REFERENCES players(id),
     words TEXT NOT NULL, score INTEGER NOT NULL, rumble INTEGER NOT NULL DEFAULT 0, made_up INTEGER NOT NULL DEFAULT 0, penalty TEXT);
   CREATE TABLE custom_words (word TEXT PRIMARY KEY, added_at TEXT NOT NULL);
   CREATE TABLE saved_game (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, saved_at TEXT NOT NULL);
   CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  `ALTER TABLE game_players ADD COLUMN shuffle_points_lost INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE game_players ADD COLUMN swap_points_lost INTEGER NOT NULL DEFAULT 0;`
]

export class GameDb {
  private constructor(
    private readonly db: Database,
    private readonly file: string | null
  ) {}

  /** Open (or create) the database at `file`; `null` keeps it in memory (tests). */
  static open(SQL: SqlJsStatic, file: string | null): GameDb {
    const bytes = file && existsSync(file) ? readFileSync(file) : undefined
    const gdb = new GameDb(new SQL.Database(bytes), file)
    gdb.migrate()
    return gdb
  }

  private migrate(): void {
    const version = Number(this.scalar('PRAGMA user_version') ?? 0)
    if (version >= MIGRATIONS.length) return
    for (let v = version; v < MIGRATIONS.length; v++) this.db.exec(MIGRATIONS[v])
    this.db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`)
    this.persist()
  }

  /** Atomic write: temp file then rename, so a crash never leaves a half-written database. */
  persist(): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, this.db.export())
    renameSync(tmp, this.file)
  }

  close(): void {
    this.db.close()
  }

  private rows(sql: string, params: Param[] = []): Row[] {
    const stmt = this.db.prepare(sql)
    try {
      stmt.bind(params)
      const out: Row[] = []
      while (stmt.step()) out.push(stmt.getAsObject() as Row)
      return out
    } finally {
      stmt.free()
    }
  }

  private scalar(sql: string, params: Param[] = []): unknown {
    const r = this.rows(sql, params)[0]
    return r ? Object.values(r)[0] : undefined
  }

  private run(sql: string, params: Param[] = []): void {
    this.db.run(sql, params)
  }

  // ---- settings ----
  getSettings(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const r of this.rows('SELECT key, value FROM settings')) out[String(r.key)] = JSON.parse(String(r.value))
    return out
  }

  setSetting(key: string, value: unknown): void {
    this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)])
    this.persist()
  }

  deleteSetting(key: string): void {
    this.run('DELETE FROM settings WHERE key = ?', [key])
    this.persist()
  }

  // ---- custom words ----
  customWords(): string[] {
    return this.rows('SELECT word FROM custom_words ORDER BY word').map((r) => String(r.word))
  }

  clearCustomWords(): void {
    this.run('DELETE FROM custom_words')
    this.persist()
  }

  addCustomWord(word: string): boolean {
    const w = word.trim().toLowerCase()
    if (!/^[a-z]{2,15}$/.test(w)) return false
    this.run('INSERT OR IGNORE INTO custom_words (word, added_at) VALUES (?, ?)', [w, new Date().toISOString()])
    this.persist()
    return true
  }

  // ---- saved game (autosave) ----
  saveGame(json: string): void {
    this.run('INSERT OR REPLACE INTO saved_game (id, json, saved_at) VALUES (1, ?, ?)', [json, new Date().toISOString()])
    this.persist()
  }

  loadGame(): string | null {
    const v = this.scalar('SELECT json FROM saved_game WHERE id = 1')
    return typeof v === 'string' ? v : null
  }

  clearSavedGame(): void {
    this.run('DELETE FROM saved_game')
    this.persist()
  }

  // ---- scores ----
  private playerId(name: string, isComputer: boolean): number {
    this.run('INSERT OR IGNORE INTO players (name, is_computer) VALUES (?, ?)', [name, isComputer ? 1 : 0])
    return Number(this.scalar('SELECT id FROM players WHERE name = ?', [name]))
  }

  /** Store a finished game; returns its id. */
  recordGame(g: GameRecord): number {
    this.db.exec('BEGIN')
    try {
      this.run(
        'INSERT INTO games (mode, difficulty, timer, options, ended_reason, played_at) VALUES (?, ?, ?, ?, ?, ?)',
        [g.mode, g.difficulty ?? null, g.timer ?? null, JSON.stringify(g.options ?? {}), g.endedReason, g.playedAt ?? new Date().toISOString()]
      )
      const gameId = Number(this.scalar('SELECT last_insert_rowid()'))
      const ids = g.players.map((p) => this.playerId(p.name, !!p.isComputer))
      g.players.forEach((p, seat) => {
        this.run(
          `INSERT INTO game_players (game_id, player_id, seat, final_score, pre_adjust_score, rumbles, hints_used,
             hint_points_lost, made_up_count, conceded, winner, shuffle_points_lost, swap_points_lost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [gameId, ids[seat], seat, p.finalScore, p.preAdjustScore, p.rumbles ?? 0, p.hintsUsed ?? 0,
           p.hintPointsLost ?? 0, p.madeUpCount ?? 0, p.conceded ? 1 : 0, p.winner ? 1 : 0,
           p.shufflePointsLost ?? 0, p.swapPointsLost ?? 0]
        )
      })
      for (const pl of g.plays ?? []) {
        this.run(
          'INSERT INTO plays (game_id, player_id, words, score, rumble, made_up, penalty) VALUES (?,?,?,?,?,?,?)',
          [gameId, ids[pl.playerIndex], JSON.stringify(pl.words), pl.score, pl.rumble ? 1 : 0, pl.madeUp ? 1 : 0, pl.penalty ?? null]
        )
      }
      this.db.exec('COMMIT')
      this.persist()
      return gameId
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }

  /** Highest final scores, optionally for one mode. */
  topScores(filter: ScoreFilter = 'all', limit = 20): Row[] {
    return this.rows(
      `SELECT p.name, gp.final_score AS score, gp.conceded, gp.winner, g.mode, g.difficulty, g.played_at AS playedAt
       FROM game_players gp JOIN games g ON g.id = gp.game_id JOIN players p ON p.id = gp.player_id
       WHERE p.is_computer = 0 AND (? = 'all' OR g.mode = ?)
       ORDER BY gp.final_score DESC, g.played_at ASC LIMIT ?`,
      [filter, filter, limit]
    )
  }

  /** Per-pair tally for two-player games (names ordered alphabetically). */
  headToHead(): Row[] {
    return this.rows(
      `SELECT a.name AS a, b.name AS b,
         COUNT(*) AS games,
         SUM(CASE WHEN gpa.winner = 1 THEN 1 ELSE 0 END) AS aWins,
         SUM(CASE WHEN gpb.winner = 1 THEN 1 ELSE 0 END) AS bWins,
         SUM(CASE WHEN gpa.winner = 0 AND gpb.winner = 0 THEN 1 ELSE 0 END) AS draws,
         SUM(gpa.conceded) AS aConceded, SUM(gpb.conceded) AS bConceded,
         AVG(gpa.final_score) AS aAvg, AVG(gpb.final_score) AS bAvg
       FROM games g
       JOIN game_players gpa ON gpa.game_id = g.id JOIN players a ON a.id = gpa.player_id
       JOIN game_players gpb ON gpb.game_id = g.id JOIN players b ON b.id = gpb.player_id AND a.name < b.name
       WHERE g.mode = 'two'
       GROUP BY a.name, b.name`
    )
  }

  bestPlays(limit = 20): Row[] {
    return this.rows(
      `SELECT p.name, pl.words, pl.score, pl.rumble, g.played_at AS playedAt
       FROM plays pl JOIN players p ON p.id = pl.player_id JOIN games g ON g.id = pl.game_id
       WHERE pl.made_up = 0 AND p.is_computer = 0 ORDER BY pl.score DESC LIMIT ?`,
      [limit]
    ).map((r) => ({ ...r, words: JSON.parse(String(r.words)) }))
  }

  recentGames(limit = 20): Row[] {
    return this.rows(
      `SELECT g.id, g.mode, g.difficulty, g.ended_reason AS endedReason, g.played_at AS playedAt,
         GROUP_CONCAT(p.name || ':' || gp.final_score || ':' || gp.winner, '|') AS players
       FROM games g JOIN game_players gp ON gp.game_id = g.id JOIN players p ON p.id = gp.player_id
       GROUP BY g.id ORDER BY g.played_at DESC, g.id DESC LIMIT ?`,
      [limit]
    )
  }

  hallOfShame(): { madeUpWords: Row[]; penalties: Row[]; perPlayer: Row[] } {
    const madeUpWords = this.rows(
      `SELECT p.name, pl.words, pl.score, pl.penalty, g.played_at AS playedAt
       FROM plays pl JOIN players p ON p.id = pl.player_id JOIN games g ON g.id = pl.game_id
       WHERE pl.made_up = 1 ORDER BY g.played_at DESC LIMIT 50`
    ).map((r) => ({ ...r, words: JSON.parse(String(r.words)) }))
    const penalties = this.rows(
      'SELECT pl.penalty AS penalty, COUNT(*) AS n FROM plays pl WHERE pl.penalty IS NOT NULL GROUP BY pl.penalty ORDER BY n DESC'
    )
    const perPlayer = this.rows(
      `SELECT p.name, SUM(gp.made_up_count) AS madeUp, SUM(gp.hints_used) AS hints,
         SUM(gp.hint_points_lost) AS hintPointsLost, SUM(gp.shuffle_points_lost) AS shufflePointsLost,
         SUM(gp.swap_points_lost) AS swapPointsLost, SUM(gp.conceded) AS defeats
       FROM game_players gp JOIN players p ON p.id = gp.player_id WHERE p.is_computer = 0 GROUP BY p.name`
    )
    return { madeUpWords, penalties, perPlayer }
  }

  /** Settings "Reset scores": wipes history; keeps custom words, settings and the autosave. */
  resetScores(): void {
    for (const t of ['plays', 'game_players', 'games', 'players']) this.run(`DELETE FROM ${t}`)
    this.persist()
  }
}
