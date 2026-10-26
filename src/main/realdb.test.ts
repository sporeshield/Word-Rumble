import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import initSqlJs, { type Database } from 'sql.js'
import { describe, expect, it } from 'vitest'
import { GameDb, MIGRATIONS } from './db'

/**
 * Opt-in: migrates a COPY of a real database and checks nothing was lost.
 *   WR_REAL_DB="Word Rumble/data/word-rumble.sqlite" pnpm vitest run src/main/realdb
 * The original file is only read, never opened by GameDb.
 */
const source = process.env.WR_REAL_DB

const all = (db: Database, sql: string) => db.exec(sql)[0]?.values ?? []
const one = (db: Database, sql: string) => all(db, sql)[0]?.[0]

describe.skipIf(!source)('real database migration (on a copy)', () => {
  it('keeps every row and every old head-to-head tally', async () => {
    expect(existsSync(source!)).toBe(true)
    const SQL = await initSqlJs()
    const before = readFileSync(source!)
    const tmp = mkdtempSync(join(tmpdir(), 'wr-realdb-'))
    try {
      const copy = join(tmp, 'word-rumble.sqlite')
      copyFileSync(source!, copy)

      const old = new SQL.Database(readFileSync(copy))
      const oldVersion = Number(one(old, 'PRAGMA user_version'))
      const tables = ['players', 'games', 'game_players', 'plays', 'custom_words', 'saved_game', 'settings']
      const counts = tables.map((t) => Number(one(old, `SELECT COUNT(*) FROM ${t}`)))
      const oldH2h = all(old, `SELECT a.name, b.name, COUNT(*),
          SUM(gpa.winner), SUM(gpb.winner), SUM(CASE WHEN gpa.winner = 0 AND gpb.winner = 0 THEN 1 ELSE 0 END)
        FROM games g
        JOIN game_players gpa ON gpa.game_id = g.id JOIN players a ON a.id = gpa.player_id
        JOIN game_players gpb ON gpb.game_id = g.id JOIN players b ON b.id = gpb.player_id AND a.name < b.name
        WHERE g.mode = 'two' AND (SELECT COUNT(*) FROM game_players x WHERE x.game_id = g.id) = 2 GROUP BY a.name, b.name`)
      old.close()

      GameDb.open(SQL, copy).close()

      const migrated = new SQL.Database(readFileSync(copy))
      console.log(`real DB: user_version ${oldVersion} -> ${one(migrated, 'PRAGMA user_version')}, rows ${tables.map((t, i) => `${t}=${counts[i]}`).join(' ')}`)
      expect(Number(one(migrated, 'PRAGMA user_version'))).toBe(MIGRATIONS.length)
      expect(tables.map((t) => Number(one(migrated, `SELECT COUNT(*) FROM ${t}`)))).toEqual(counts)
      expect(Number(one(migrated, 'SELECT COUNT(*) FROM game_players WHERE rank IS NULL'))).toBe(0)
      // Winners are 1st; nobody else is.
      expect(Number(one(migrated, 'SELECT COUNT(*) FROM game_players WHERE winner = 1 AND rank <> 1'))).toBe(0)
      migrated.close()

      const migrated2 = () => new SQL.Database(readFileSync(copy))
      const h2h = GameDb.open(SQL, copy).headToHead().map((r) => [r.a, r.b, r.games, r.aWins, r.bWins, r.draws])
      // Old winner flags only describe 2-player games; 3–4 player tables are ranked by place (not comparable).
      const multi = Number(one(migrated2(), `SELECT COUNT(*) FROM (SELECT game_id FROM game_players GROUP BY game_id HAVING COUNT(*) > 2)`))
      if (multi === 0) expect(h2h).toEqual(oldH2h)
      expect(readFileSync(source!).equals(before)).toBe(true)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
