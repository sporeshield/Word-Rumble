import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const EXTENSIONS = new Set(['.wav', '.mp3', '.ogg'])

export interface SoundEntry {
  name: string
  file: string
  custom: boolean
}

function scan(dir: string, custom: boolean): SoundEntry[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => EXTENSIONS.has(extname(f).toLowerCase()))
    .map((file) => ({ name: basename(file, extname(file)).toLowerCase(), file, custom }))
}

/** Built-in sounds, with any same-named file in `sounds/custom` replacing the built-in one. */
export function listSounds(builtInDir: string, customDir: string): SoundEntry[] {
  const byName = new Map<string, SoundEntry>()
  for (const s of scan(builtInDir, false)) byName.set(s.name, s)
  for (const s of scan(customDir, true)) byName.set(s.name, s)
  return [...byName.values()]
}

/** Read one listed file; file names are checked so the renderer can't climb out of the folders. */
export function readSound(builtInDir: string, customDir: string, file: string, custom: boolean): Uint8Array | null {
  if (file !== basename(file) || !EXTENSIONS.has(extname(file).toLowerCase())) return null
  try {
    return new Uint8Array(readFileSync(join(custom ? customDir : builtInDir, file)))
  } catch {
    return null
  }
}
