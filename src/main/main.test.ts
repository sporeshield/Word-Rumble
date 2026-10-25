import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GameDb } from './db'
import { listSounds, readSound } from './sounds'
import { WordService } from './words'

let SQL: SqlJsStatic
const tmp = mkdtempSync(join(tmpdir(), 'wr-test-'))

beforeAll(async () => {
  SQL = await initSqlJs()
})
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const game = (shane: number, dawn: number, extra = {}) => ({
  mode: 'two' as const,
  endedReason: 'bag-empty',
  players: [
    { name: 'Shane', finalScore: shane, preAdjustScore: shane, winner: shane > dawn },
    { name: 'Dawn', finalScore: dawn, preAdjustScore: dawn, winner: dawn > shane }
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
    db.recordGame({ mode: 'solo', endedReason: 'finished', players: [{ name: 'Shane', finalScore: 410, preAdjustScore: 420 }] })

    const top = db.topScores('all')
    expect(top.map((r) => r.score)).toEqual([410, 300, 280, 250, 200])
    expect(db.topScores('solo')).toHaveLength(1)

    const h2h = db.headToHead()
    expect(h2h).toHaveLength(1)
    expect(h2h[0]).toMatchObject({ a: 'Dawn', b: 'Shane', games: 2, aWins: 1, bWins: 1 })

    expect(db.bestPlays()[0]).toMatchObject({ name: 'Shane', score: 44, words: ['QUIZ'] })
    expect(db.recentGames()[0].playedAt).toBe('2030-01-01T00:00:00Z')

    const shame = db.hallOfShame()
    expect(shame.madeUpWords).toHaveLength(2)
    expect(shame.penalties).toEqual([{ penalty: 'half', n: 2 }])

    db.resetScores()
    expect(db.topScores('all')).toEqual([])
  })

  it('keeps computer players out of the high scores', () => {
    const db = GameDb.open(SQL, null)
    db.recordGame({
      mode: 'computer',
      difficulty: 'hard',
      endedReason: 'bag-empty',
      players: [
        { name: 'Shane', finalScore: 100, preAdjustScore: 100 },
        { name: 'Computer', isComputer: true, finalScore: 500, preAdjustScore: 500, winner: true }
      ]
    })
    expect(db.topScores('computer').map((r) => r.name)).toEqual(['Shane'])
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
