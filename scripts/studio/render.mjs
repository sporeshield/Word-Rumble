// Renders recipe variants through REAPER's command line, one at a time (flat RAM), and reports
// size, peak, loudness and REAPER's peak memory.
// Usage: node scripts/studio/render.mjs [--wav] [name ...]
//   default: writes <name>--<variant>.ogg to .cache/studio/out. --wav also renders a 24-bit WAV to measure.
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyze } from './analyze.mjs'
import { writeProjects } from './build-rpp.mjs'
import { outDir, reaperCfgDir, reaperExe, root, studioDir } from './lib.mjs'

// The lean REAPER config: dummy audio device, no undo, no peak files. A personal REAPER setup is never touched.
export const prepareConfig = () => {
  mkdirSync(reaperCfgDir, { recursive: true })
  const appData = process.env.APPDATA ?? ''
  // Plug-in cache and licence are copied so the lean config knows Vital (and stays licensed) without a rescan.
  for (const f of ['reaper-vstplugins64.ini', 'reaper-reginfo2.ini']) {
    const from = join(appData, 'REAPER', f)
    if (existsSync(from)) copyFileSync(from, join(reaperCfgDir, f))
  }
  writeFileSync(join(reaperCfgDir, 'REAPER.ini'), '[REAPER]\nundomaxmem=0\nprojsavepeaks=0\nautosaveint=0\nshowpeaks=0\nsplash=0\n[audioconfig]\nmode=9\n')
  return join(reaperCfgDir, 'REAPER.ini')
}

const peakMemoryMb = (pid) => {
  const r = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' })
  const m = /"([\d,]+) K"\s*$/m.exec(r.stdout)
  return m ? Number(m[1].replaceAll(',', '')) / 1024 : 0
}

const renderOne = (ini, rpp) =>
  new Promise((resolve, reject) => {
    const child = spawn(reaperExe(), ['-cfgfile', ini, '-nosplash', '-renderproject', rpp], { stdio: 'ignore' })
    let peak = 0
    const timer = setInterval(() => { peak = Math.max(peak, peakMemoryMb(child.pid)) }, 750)
    const kill = setTimeout(() => child.kill(), 120000)
    child.on('error', reject)
    child.on('exit', () => { clearInterval(timer); clearTimeout(kill); resolve(peak) })
  })

export const renderAll = async (names, { wav = false } = {}) => {
  const ini = prepareConfig()
  mkdirSync(outDir, { recursive: true })
  const results = []
  for (const format of wav ? ['wav', 'ogg'] : ['ogg']) {
    for (const rpp of writeProjects(names, { format })) {
      const out = join(outDir, `${basename(rpp).split('.')[0]}.${format}`)
      rmSync(out, { force: true })
      const mb = await renderOne(ini, rpp)
      if (!existsSync(out)) throw new Error(`REAPER produced no file for ${basename(rpp)}`)
      const row = { file: basename(out), kb: +(statSync(out).size / 1024).toFixed(1), reaperMb: Math.round(mb) }
      if (format === 'wav') Object.assign(row, analyze(out))
      results.push(row)
    }
  }
  return results
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const rows = await renderAll(args.filter((a) => !a.startsWith('--')), { wav: args.includes('--wav') })
  console.table(rows.map((r) => ({ ...r, seconds: r.seconds?.toFixed(2), peakDb: r.peakDb?.toFixed(1), lufs: r.lufs?.toFixed(1) })))
}
