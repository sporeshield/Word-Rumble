// Measures every sound in resources/sounds (one REAPER launch: each file is an item with its own region,
// rendered to a stereo 24-bit WAV) and writes the gain that brings each one to its group's loudness target.
// Usage: node scripts/studio/levels.mjs [name ...]   (no names = every sound; named ones are merged into levels.json)
// Output: src/renderer/audio/levels.json  { "<name>": { group, lufs, peakDb, gainDb } }, applied by sfx.ts to built-in sounds.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyze } from './analyze.mjs'
import { reaperExe, root, studioDir } from './lib.mjs'
import { prepareConfig } from './render.mjs'
import { spawnSync } from 'node:child_process'

const soundsDir = join(root, 'resources', 'sounds')
const levelsFile = join(root, 'src', 'renderer', 'audio', 'levels.json')
const workDir = join(studioDir, 'levels')
const PEAK_CEILING_DB = -1
const MAX_BOOST_DB = 12

// Loudness targets (LUFS) by sound group; the first matching rule wins.
export const GROUPS = [
  { group: 'ui', target: -22, match: /^(ui-|tile-drag-tick|timer-tick|rack-reorder|flip-|page-flip|pencil-scribble|rank-reveal)/ },
  { group: 'tiles', target: -18, match: /^(tile-|recall-all|rack-shuffle|blank-chosen|exchange|pass|bag-shake|first-draw-reveal|pause|resume|dice-roll|wheel-|penalty-cost|hint-ghost|power-preview|player-joins|word-)/ },
  { group: 'voice', target: -16, match: /^(male-)?(count-|voice-)/ },
  { group: 'heartbeat', target: -20, match: /^heartbeat/ },
  { group: 'silly', target: -17, match: /^power-annoy-/ },
  { group: 'big', target: -14, match: /^(burst-|kablam-|countdown-boom|power-reveal|rumble-fanfare|game-over-fanfare|high-score-ding|defeat-trombone|drop-out|gift-given|quit-nosave|buzzer)/ },
]
export const groupOf = (name) => GROUPS.find((g) => g.match.test(name)) ?? { group: 'tiles', target: -18 }

// Length in seconds without decoding: WAV from its header, OGG from the last page's granule position.
const lengthOf = (file) => {
  const b = readFileSync(file)
  if (b.toString('ascii', 0, 4) === 'RIFF') {
    const byteRate = b.readUInt32LE(28)
    const at = b.indexOf('data', 12, 'ascii')
    return b.readUInt32LE(at + 4) / byteRate
  }
  const rate = b.readUInt32LE(b.indexOf('vorbis', 0, 'ascii') + 11)
  const last = b.lastIndexOf('OggS')
  return Number(b.readBigUInt64LE(last + 6)) / rate
}

const guid = (i) => `{00000000-0000-4000-8000-${String(i).padStart(12, '0')}}`

const buildProject = (files) => {
  const out = workDir.split(String.fromCharCode(92)).join('/')
  const items = []
  const regions = []
  let at = 1
  files.forEach((f, i) => {
    const len = lengthOf(join(soundsDir, f))
    const source = f.endsWith('.wav') ? 'WAVE' : 'VORBIS'
    const path = join(soundsDir, f).split(String.fromCharCode(92)).join('/')
    items.push('    <ITEM', `      POSITION ${at}`, `      LENGTH ${len}`, `      <SOURCE ${source}`, `        FILE "${path}"`, '      >', '    >')
    const name = f.replace(/\.(ogg|wav)$/, '')
    regions.push(`  MARKER ${i + 1} ${at} "${name}" 1 0 1 B ${guid(i + 1)} 0`, `  MARKER ${i + 1} ${at + len} "" 1 0 1 B ${guid(i + 1)} 0`)
    at += len + 1
  })
  return [
    '<REAPER_PROJECT 0.1 "7.83/win64" 1793037055 0',
    '  SAMPLERATE 44100 0 0',
    ...regions,
    `  RENDER_FILE "${out}"`,
    '  RENDER_PATTERN "$region"',
    '  RENDER_FMT 0 2 0', // master mix, stereo, project rate
    '  RENDER_RANGE 3 0 0 0 1000', // every project region
    '  RENDER_ADDTOPROJ 0',
    '  <RENDER_CFG',
    '    ZXZhdxgAAQ==',
    '  >',
    '  <TRACK',
    '    NAME "levels"',
    ...items,
    '  >',
    '>',
    '',
  ].join('\n')
}

export const measure = (files) => {
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(workDir, { recursive: true })
  const rpp = join(workDir, 'levels.rpp')
  writeFileSync(rpp, buildProject(files))
  const ini = prepareConfig()
  spawnSync(reaperExe(), ['-cfgfile', ini, '-nosplash', '-renderproject', rpp], { stdio: 'ignore', timeout: 600000 })
  const rows = {}
  for (const f of files) {
    const name = f.replace(/\.(ogg|wav)$/, '')
    const wav = join(workDir, `${name}.wav`)
    if (!existsSync(wav)) throw new Error(`REAPER did not render ${name}`)
    const m = analyze(wav)
    const { group, target } = groupOf(name)
    const raw = Number.isFinite(m.lufs) ? target - m.lufs : 0
    const gainDb = Math.min(raw, MAX_BOOST_DB, PEAK_CEILING_DB - m.peakDb)
    rows[name] = { group, seconds: +m.seconds.toFixed(2), lufs: +m.lufs.toFixed(1), peakDb: +m.peakDb.toFixed(1), gainDb: +gainDb.toFixed(1) }
  }
  return rows
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wanted = process.argv.slice(2)
  const files = readdirSync(soundsDir).filter((f) => /\.(ogg|wav)$/.test(f) && (!wanted.length || wanted.includes(f.replace(/\.(ogg|wav)$/, ''))))
  const rows = measure(files)
  const old = existsSync(levelsFile) && wanted.length ? JSON.parse(readFileSync(levelsFile, 'utf8')) : {}
  const merged = Object.fromEntries(Object.entries({ ...old, ...rows }).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(levelsFile, `${JSON.stringify(merged, null, 2)}\n`)
  console.table(rows)
}
