import { app } from 'electron'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

/**
 * Portable folder resolution. Packaged: everything sits next to the exe
 * (`Word Rumble/`). Dev: the project root, with `dev-data/` so testing never
 * touches real scores. No absolute path is ever stored anywhere.
 */
function gameRoot(): string {
  return app.isPackaged ? dirname(process.execPath) : app.getAppPath()
}

export function dataDir(): string {
  return app.isPackaged ? join(gameRoot(), 'data') : join(gameRoot(), 'dev-data')
}

export function electronDataDir(): string {
  return join(dataDir(), 'electron')
}

export function customSoundsDir(): string {
  return app.isPackaged ? join(gameRoot(), 'sounds', 'custom') : join(dataDir(), 'sounds', 'custom')
}

export function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(gameRoot(), 'resources')
}

/** Create the folders and point Electron's own storage inside the game folder. Call before app ready. */
export function setupPortablePaths(): void {
  for (const dir of [dataDir(), electronDataDir(), customSoundsDir()]) {
    mkdirSync(dir, { recursive: true })
  }
  app.setPath('userData', electronDataDir())
  app.setPath('sessionData', join(electronDataDir(), 'session'))
}
