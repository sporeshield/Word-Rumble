import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GameDb, MIGRATIONS } from './db'
import { listSounds, readSound } from './sounds'
import { WordService } from './words'

let SQL: SqlJsStatic
const tmp = mkdtempSync(join(tmpdir(), 'wr-test-'))

beforeAll(async () => {
  SQL = await initSqlJs()
})
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const game = (tess: number, blair: number, extra = {}) => ({
  mode: 'two' as const,
  endedReason: 'bag-empty',
  players: [
    { name: 'Tess', finalScore: tess, preAdjustScore: tess, winner: tess > blair },
    { name: 'Blair', finalScore: blair, preAdjustScore: blair, winner: blair > tess }
  ],
  plays: [
    { playerIndex: 0, words: ['QUIZ'], score: 44 },
    { playerIndex: 1, words: ['FIBB'], score: 10, madeUp: true, penalty: 'half' }
  ],
  ...extra
})

describe('GameDb', () => {
  it('persists to disk and reloads (atomic write leaves no temp file)', () => {
    const file = join(tmp, 'a', 'wr.sqlite')
    const db = GameDb.open(SQL, file)
    db.setSetting('volume', 0.5)
    db.addCustomWord('Zorp')
    db.saveGame('{"turn":3}')
    db.close()
    expect(readdirSync(join(tmp, 'a'))).toEqual(['wr.sqlite'])

    const again = GameDb.open(SQL, file)
    expect(again.getSettings()).toEqual({ volume: 0.5 })
    expect(again.customWords()).toEqual(['zorp'])
    expect(again.loadGame()).toBe('{"turn":3}')
    again.clearSavedGame()
    expect(again.loadGame()).toBeNull()
  })

  it('rejects bad custom words', () => {
    const db = GameDb.open(SQL, null)
    expect(db.addCustomWord('a')).toBe(false)
    expect(db.addCustomWord('no way')).toBe(false)
    expect(db.addCustomWord('ok-ish')).toBe(false)
    expect(db.addCustomWord('Fizzbuzz')).toBe(true)
  })

  it('records games and answers the notebook queries', () => {
    const db = GameDb.open(SQL, null)
    db.recordGame(game(300, 250))
    db.recordGame(game(200, 280, { playedAt: '2030-01-01T00:00:00Z' }))
    db.recordGame({ mode: 'solo', endedReason: 'finished', players: [{ name: 'Tess', finalScore: 410, preAdjustScore: 420 }] })

    const top = db.topScores('all')
    expect(top.map((r) => r.score)).toEqual([410, 300, 280, 250, 200])
    expect(db.topScores('solo')).toHaveLength(1)

    const h2h = db.headToHead()
    expect(h2h).toHaveLength(1)
    expect(h2h[0]).toMatchObject({ a: 'Blair', b: 'Tess', games: 2, aWins: 1, bWins: 1 })

    expect(db.bestPlays()[0]).toMatchObject({ name: 'Tess', score: 44, words: ['QUIZ'] })
    expect(db.recentGames()[0].playedAt).toBe('2030-01-01T00:00:00Z')

    const shame = db.hallOfShame()
    expect(shame.madeUpWords).toHaveLength(2)
    expect(shame.penalties).toEqual([{ penalty: 'half', n: 2 }])

    db.resetScores()
    expect(db.topScores('all')).toEqual([])
  })

  it('migrates a version-2 database: ranks from winner, draws share 1st', () => {
    const old = new SQL.Database()
    old.exec(MIGRATIONS[0])
    old.exec(MIGRATIONS[1])
    old.exec(`PRAGMA user_version = 2;
      INSERT INTO players (id, name) VALUES (1, 'Tess'), (2, 'Blair');
      INSERT INTO games (id, mode, ended_reason, played_at) VALUES (1, 'two', 'out', 'a'), (2, 'two', 'out', 'b'), (3, 'solo', 'finished', 'c');
      INSERT INTO game_players (game_id, player_id, seat, final_score, pre_adjust_score, winner) VALUES
        (1, 1, 0, 300, 300, 1), (1, 2, 1, 200, 200, 0),
        (2, 1, 0, 250, 250, 0), (2, 2, 1, 250, 250, 0),
        (3, 1, 0, 400, 400, 0);`)
    const file = join(tmp, 'v2', 'wr.sqlite')
    mkdirSync(join(tmp, 'v2'))
    writeFileSync(file, old.export())
    old.close()

    const db = GameDb.open(SQL, file)
    db.close()
    const check = new SQL.Database(readFileSync(file))
    expect(check.exec('PRAGMA user_version')[0].values[0][0]).toBe(MIGRATIONS.length)
    expect(check.exec('SELECT game_id, rank, given_away, gift_to FROM game_players ORDER BY id')[0].values).toEqual([
      [1, 1, 0, null], [1, 2, 0, null], [2, 1, 0, null], [2, 1, 0, null], [3, 1, 0, null]
    ])
    check.close()
    expect(GameDb.open(SQL, file).headToHead()[0]).toMatchObject({ a: 'Blair', b: 'Tess', games: 2, aWins: 0, bWins: 1, draws: 1 })
  })

  it('tallies every pair of a 3-player game by place and lists recent players by place', () => {
    const db = GameDb.open(SQL, null)
    db.recordGame({
      mode: 'two', endedReason: 'conceded', playedAt: '2030-01-01T00:00:00Z',
      players: [
        { name: 'Tess', finalScore: 0, preAdjustScore: 0, rank: 3, conceded: true, givenAway: 30, giftTo: 'Blair' },
        { name: 'Blair|Ann', finalScore: 90, preAdjustScore: 90, rank: 1, winner: true },
        { name: 'Pip', finalScore: 90, preAdjustScore: 90, rank: 1 }
      ]
    })
    const h2h = db.headToHead()
    expect(h2h.map((r) => [r.a, r.b, r.aWins, r.bWins, r.draws])).toEqual([
      ['Blair|Ann', 'Pip', 0, 0, 1], ['Blair|Ann', 'Tess', 1, 0, 0], ['Pip', 'Tess', 1, 0, 0]
    ])
    const [recent] = db.recentGames()
    expect(recent.players).toEqual([
      { name: 'Blair|Ann', isComputer: false, score: 90, rank: 1, winner: true, conceded: false, givenAway: 0, giftTo: null },
      { name: 'Pip', isComputer: false, score: 90, rank: 1, winner: false, conceded: false, givenAway: 0, giftTo: null },
      { name: 'Tess', isComputer: false, score: 0, rank: 3, winner: false, conceded: true, givenAway: 30, giftTo: 'Blair' }
    ])
  })

  it('works out a rank when a record only has winner flags', () => {
    const db = GameDb.open(SQL, null)
    db.recordGame(game(300, 250))
    db.recordGame(game(260, 260))
    expect(db.recentGames().map((g) => (g.players as { rank: number }[]).map((p) => p.rank))).toEqual([[1, 1], [1, 2]])
  })

  it('keeps computer players out of the high scores', () => {
    const db = GameDb.open(SQL, null)
    db.recordGame({
      mode: 'computer',
      difficulty: 'hard',
      endedReason: 'bag-empty',
      players: [
        { name: 'Tess', finalScore: 100, preAdjustScore: 100 },
        { name: 'Computer', isComputer: true, finalScore: 500, preAdjustScore: 500, winner: true }
      ]
    })
    expect(db.topScores('computer').map((r) => r.name)).toEqual(['Tess'])
  })
})

describe('WordService', () => {
  const words = new WordService(join(__dirname, '../../resources/words'), ['zorp'])

  it('loads ENABLE, extras and custom words', () => {
    expect(words.size).toBeGreaterThan(172000)
    expect(words.has('quiz')).toBe(true)
    expect(words.has('QI')).toBe(true)
    expect(words.has('zorp')).toBe(true)
    expect(words.has('xyzzyq')).toBe(false)
  })

  it('reports missing words once, lower-case, and can learn new ones', () => {
    expect(words.missing(['QUIZ', 'blorf', 'BLORF', 'qwxz'])).toEqual(['blorf', 'qwxz'])
    words.add('Blorf')
    expect(words.missing(['blorf'])).toEqual([])
  })
  it('forgets custom words but keeps built-in ones', () => {
    const w = new WordService(join(__dirname, '../../resources/words'), ['zorp'])
    w.add('quix')
    w.add('cat')
    w.clearCustom()
    expect(w.has('zorp')).toBe(false)
    expect(w.has('quix')).toBe(false)
    expect(w.has('cat')).toBe(true)
  })
})

describe('sounds', () => {
  it('lets sounds/custom override built-ins and blocks path tricks', () => {
    const built = join(tmp, 'built')
    const custom = join(tmp, 'custom')
    mkdirSync(built)
    mkdirSync(custom)
    writeFileSync(join(built, 'tile-place.ogg'), 'a')
    writeFileSync(join(built, 'pop.wav'), 'b')
    writeFileSync(join(custom, 'Tile-Place.mp3'), 'c')
    writeFileSync(join(custom, 'notes.txt'), 'x')

    const list = listSounds(built, custom).sort((a, b) => a.name.localeCompare(b.name))
    expect(list).toEqual([
      { name: 'pop', file: 'pop.wav', custom: false },
      { name: 'tile-place', file: 'Tile-Place.mp3', custom: true }
    ])
    expect(Buffer.from(readSound(built, custom, 'Tile-Place.mp3', true)!).toString()).toBe('c')
    expect(readSound(built, custom, '../built/pop.wav', true)).toBeNull()
    expect(readSound(built, custom, 'missing.wav', false)).toBeNull()
  })
})
