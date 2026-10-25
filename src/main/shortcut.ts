import { app, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { ShortcutStatus } from '../shared/api'

const NAME = 'Word Rumble.lnk'

function shortcutPath(): string {
  return join(app.getPath('desktop'), NAME)
}

const same = (a: string, b: string): boolean => resolve(a).toLowerCase() === resolve(b).toLowerCase()

/** Does the desktop shortcut exist, and does it point at the exe that is running now? */
export function shortcutStatus(declined: boolean): ShortcutStatus {
  if (!app.isPackaged || process.platform !== 'win32') {
    return { available: false, exists: false, needsRepair: false, declined }
  }
  const path = shortcutPath()
  if (!existsSync(path)) return { available: true, exists: false, needsRepair: false, declined }
  try {
    const link = shell.readShortcutLink(path)
    return { available: true, exists: true, needsRepair: !same(link.target, process.execPath), declined }
  } catch {
    return { available: true, exists: true, needsRepair: true, declined }
  }
}

/** Create the shortcut, or replace one that points somewhere else (e.g. after moving the folder). */
export function createShortcut(): boolean {
  if (!app.isPackaged || process.platform !== 'win32') return false
  const exe = process.execPath
  const operation = existsSync(shortcutPath()) ? 'replace' : 'create'
  return shell.writeShortcutLink(shortcutPath(), operation, {
    target: exe,
    cwd: dirname(exe),
    icon: exe,
    iconIndex: 0,
    description: 'Word Rumble'
  })
}
