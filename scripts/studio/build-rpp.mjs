// Writes one REAPER project (.rpp) per recipe variant: one track, one Vital instance, one MIDI item.
// Usage: node scripts/studio/build-rpp.mjs [name ...]   (no names = every recipe)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPreset, outDir, rppDir, setPath, vitalStateLines } from './lib.mjs'

const TICKS_PER_QN = 960
const TICKS_PER_SECOND = 1920 // 120 bpm, the project default
const SAMPLE_RATE = 44100

// REAPER render format blobs (base64 of a 4-char tag reversed + settings). OGG: 'vggo', int32 1, float quality.
const oggConfig = (quality) => {
  const b = Buffer.alloc(12)
  b.write('vggo', 0, 'latin1')
  b.writeInt32LE(1, 4)
  b.writeFloatLE(quality, 8)
  return b.toString('base64')
}
const WAV_CONFIG = 'ZXZhdxgAAQ==' // 24-bit wav, as REAPER writes it

const recipes = () => JSON.parse(readFileSync(new URL('./recipes.json', import.meta.url), 'utf8'))

export const variantsOf = (recipe) => {
  const names = Object.keys(recipe.variants ?? { A: {} })
  return names.map((variant) => ({ variant, ...merge(recipe, recipe.variants?.[variant] ?? {}) }))
}
const merge = (base, over) => ({
  ...base,
  ...over,
  tweaks: { ...(base.tweaks ?? {}), ...(over.tweaks ?? {}) },
})

const midiEvents = (recipe) => {
  const events = []
  for (const n of recipe.notes ?? [{ t: 0, len: 0.4, pitch: 48, vel: 110 }]) {
    events.push([Math.round(n.t * TICKS_PER_SECOND), 0x90, n.pitch, n.vel ?? 100])
    events.push([Math.round((n.t + n.len) * TICKS_PER_SECOND), 0x80, n.pitch, 0])
  }
  for (const b of recipe.bend ?? []) {
    const value = Math.max(0, Math.min(16383, Math.round(8192 + b.v * 8191))) // v is -1..1 of the bend range
    events.push([Math.round(b.t * TICKS_PER_SECOND), 0xe0, value & 0x7f, value >> 7])
  }
  events.sort((a, b) => a[0] - b[0])
  let last = 0
  return events.map(([tick, status, d1, d2]) => {
    const line = `E ${tick - last} ${status.toString(16)} ${d1.toString(16).padStart(2, '0')} ${d2.toString(16).padStart(2, '0')}`
    last = tick
    return line
  })
}

export const buildRpp = (recipe, { format = 'ogg', quality = 0.4, normalize = null } = {}) => {
  const preset = loadPreset(recipe.preset)
  for (const [path, value] of Object.entries(recipe.tweaks ?? {})) setPath(preset, path, value)
  const length = recipe.length ?? 1.5
  const noteEnd = Math.max(...(recipe.notes ?? [{ t: 0, len: 0.4 }]).map((n) => n.t + n.len))
  const out = outDir.split(String.fromCharCode(92)).join('/')
  const lines = [
    '<REAPER_PROJECT 0.1 "7.83/win64" 1793037055 0',
    `  SAMPLERATE ${SAMPLE_RATE} 0 0`,
    `  RENDER_FILE "${out}"`,
    `  RENDER_PATTERN "${recipe.name}--${recipe.variant}"`,
    '  RENDER_FMT 0 1 0', // master mix, mono, project rate
    `  RENDER_RANGE 0 0 ${length} 0 1000`,
    '  RENDER_ADDTOPROJ 0',
    ...(normalize ? [`  RENDER_NORMALIZE ${normalize}`] : []),
    '  <RENDER_CFG',
    `    ${format === 'wav' ? WAV_CONFIG : oggConfig(quality)}`,
    '  >',
    '  <TRACK',
    '    NAME "synth"',
    '    <FXCHAIN',
    '      <VST "VST3i: Vital (Vital Audio)" Vital.vst3 0 "" 1854596000{56535456697461766974616C00000000} ""',
    ...vitalStateLines(preset).map((l) => `        ${l}`),
    '      >',
    '    >',
    '    <ITEM',
    '      POSITION 0',
    `      LENGTH ${noteEnd}`,
    '      <SOURCE MIDI',
    `        HASDATA 1 ${TICKS_PER_QN} QN`,
    ...midiEvents(recipe).map((l) => `        ${l}`),
    '      >',
    '    >',
    '  >',
    '>',
    '',
  ]
  return lines.join('\n')
}

// A lossless 24-bit WAV copy of each variant is also written (for measuring) when `wav` is true.
export const writeProjects = (names, options = {}) => {
  mkdirSync(rppDir, { recursive: true })
  mkdirSync(outDir, { recursive: true })
  const written = []
  for (const recipe of recipes()) {
    if (names.length && !names.includes(recipe.name)) continue
    for (const v of variantsOf(recipe)) {
      const file = join(rppDir, `${v.name}--${v.variant}.${options.format ?? 'ogg'}.rpp`)
      writeFileSync(file, buildRpp(v, options))
      written.push(file)
    }
  }
  return written
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = writeProjects(process.argv.slice(2))
  console.log(files.map((f) => `wrote ${f}`).join('\n') || 'no matching recipes')
}
