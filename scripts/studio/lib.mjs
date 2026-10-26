// Shared helpers for the sound studio (build tools only; nothing here ships in the game).
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const studioDir = join(root, '.cache', 'studio')
export const outDir = join(studioDir, 'out')
export const rppDir = join(studioDir, 'rpp')
export const reaperCfgDir = join(studioDir, 'reaper')

export const reaperExe = () => {
  const exe = process.env.REAPER_EXE ?? 'C:/Program Files/REAPER (x64)/reaper.exe'
  if (!existsSync(exe)) throw new Error(`REAPER not found at ${exe} (set REAPER_EXE)`)
  return exe
}

export const vitalDir = () => process.env.VITAL_DIR ?? join(homedir(), 'Documents', 'Vital')

// Preset path in a recipe is relative to the Vital user folder, e.g. "Afro/Presets/Kick Drum 1.vital".
export const loadPreset = (relative) => {
  const file = join(vitalDir(), relative)
  if (!existsSync(file)) throw new Error(`Vital preset not found: ${file}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

// Set `a.b.c` inside a plain object (recipe "tweaks").
export const setPath = (obj, path, value) => {
  const keys = path.split('.')
  let at = obj
  for (const key of keys.slice(0, -1)) {
    if (typeof at[key] !== 'object' || at[key] === null) throw new Error(`Tweak path "${path}" does not exist in the preset`)
    at = at[key]
  }
  if (!(keys.at(-1) in at)) throw new Error(`Tweak path "${path}" does not exist in the preset`)
  at[keys.at(-1)] = value
}

// REAPER's VST3 state for Vital: a 184-byte header (VstW / CcnK / FBCh wrapper, with a little-endian length at byte 0 and big-endian
// lengths at bytes 28 and 180), then Vital's own JSON, then a fixed 40-byte JUCE trailer. Captured from a
// project REAPER saved itself (see docs/SOUND-PLAN.md); the JSON is exactly the `.vital` preset format.
const HEADER = Buffer.concat([
  Buffer.from('abba0200010000005673745700000008000000010000000043636e4b0002ba93464243680000000256697461', 'hex'),
  Buffer.from('00010604', 'hex'),
  Buffer.alloc(132),
  Buffer.from('0002b9fb', 'hex'),
])
const TRAILER = Buffer.from('00000000000000000000000000000000004a55434550726976617465446174610000000000000000', 'hex')
if (HEADER.length !== 184) throw new Error(`Vital header constant is ${HEADER.length} bytes, expected 184`)

export const vitalChunk = (preset) => {
  const json = Buffer.from(typeof preset === 'string' ? preset : JSON.stringify(preset), 'utf8')
  const body = Buffer.concat([HEADER, json, TRAILER])
  body.writeUInt32LE(body.length - 16, 0) // wrapper size, little-endian, in the first four bytes
  body.writeUInt32BE(body.length - 40, 28) // CcnK payload: everything after the length field except REAPER's last 8 bytes
  body.writeUInt32BE(json.length + 32, 180) // Vital data block: the JSON plus 32 bytes of padding
  return body
}

export const wrapBase64 = (buf, width = 128) => {
  const text = buf.toString('base64')
  const lines = []
  for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width))
  return lines
}

// REAPER writes the VST3 state as two base64 streams: a 44-byte header line (8-byte plug-in id, then
// little-endian u32s: 0, 2, 1, 0, 2, 0, state length, 1, 0xffff) followed by the chunk above.
export const vitalStateLines = (preset) => {
  const chunk = vitalChunk(preset)
  const head = Buffer.alloc(44)
  Buffer.from('a0e38a6eee5eedfe', 'hex').copy(head, 0)
  ;[0, 2, 1, 0, 2, 0, chunk.length, 1, 0xffff].forEach((v, i) => head.writeUInt32LE(v, 8 + i * 4))
  return [head.toString('base64'), ...wrapBase64(chunk)]
}
