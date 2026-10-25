import { app, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { GameDb } from './db'
import { customSoundsDir, dataDir, resourcesDir } from './paths'
import { createShortcut, shortcutStatus } from './shortcut'
import { listSounds, readSound } from './sounds'
import { WordService } from './words'
import type { GameRecord, ScoreFilter } from '../shared/api'

const lookupUrl = (word: string): string | null =>
  /^[a-z]{1,15}$/i.test(word) ? `https://scrabble.merriam.com/finder/${word.toLowerCase()}` : null

/** Open the database + word list and register every `wr:` IPC channel. Call after app ready. */
export async function registerIpc(): Promise<void> {
  const wasm = readFileSync(createRequire(__filename).resolve('sql.js/dist/sql-wasm.wasm'))
  const SQL = await initSqlJs({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer })
  const db = GameDb.open(SQL, join(dataDir(), 'word-rumble.sqlite'))
  const words = new WordService(join(resourcesDir(), 'words'), db.customWords())
  const builtInSounds = join(resourcesDir(), 'sounds')

  const handle = (channel: string, fn: (...args: any[]) => unknown): void => {
    ipcMain.handle(`wr:${channel}`, (_event, ...args) => fn(...args))
  }

  handle('words:check', (list: string[]) => words.missing(list))
  handle('words:add', (word: string) => {
    const ok = db.addCustomWord(word)
    if (ok) words.add(word)
    return ok
  })
  handle('words:all', () => words.all())

  handle('scores:record', (game: GameRecord) => db.recordGame(game))
  handle('scores:top', (filter?: ScoreFilter, limit?: number) => db.topScores(filter, limit))
  handle('scores:headToHead', () => db.headToHead())
  handle('scores:bestPlays', (limit?: number) => db.bestPlays(limit))
  handle('scores:recent', (limit?: number) => db.recentGames(limit))
  handle('scores:hallOfShame', () => db.hallOfShame())
  handle('scores:reset', () => db.resetScores())

  handle('savedGame:load', () => db.loadGame())
  handle('savedGame:save', (json: string) => db.saveGame(json))
  handle('savedGame:clear', () => db.clearSavedGame())

  handle('settings:get', () => db.getSettings())
  handle('settings:set', (key: string, value: unknown) => db.setSetting(key, value))

  handle('sounds:list', () => listSounds(builtInSounds, customSoundsDir()))
  handle('sounds:read', (file: string, custom: boolean) => readSound(builtInSounds, customSoundsDir(), file, custom))

  handle('shortcut:status', () => shortcutStatus(db.getSettings().shortcutDeclined === true))
  handle('shortcut:create', () => createShortcut())
  handle('shortcut:decline', () => db.setSetting('shortcutDeclined', true))

  handle('openLookup', async (word: string) => {
    const url = lookupUrl(word)
    if (url) await shell.openExternal(url)
  })
  handle('quit', () => app.quit())

  app.on('before-quit', () => db.persist())
}
