import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import levels from './audio/levels.json'
import { sfx } from './audio/sfx'
import './components/theme.css'
import './soundboard.css'

type SoundEntry = { name: string; file: string; custom: boolean }
type Level = { group: string; seconds: number; lufs: number; peakDb: number; gainDb: number }
type Flag = { bad: boolean; note: string }
type Flags = Record<string, Flag>

const levelTable: Record<string, Level> = levels
const targetLufs: Record<string, number> = {
  ui: -22, tiles: -18, voice: -16, heartbeat: -20, silly: -17, big: -14
}
const sections = [
  'Tiles & board', 'Menus & notebook', 'Words & penalties', 'Timer',
  'Bursts', 'Power squares', 'Game over', 'Other'
] as const
type Section = typeof sections[number]

function sectionFor(name: string): Section {
  if (/^(tile-|rack-|flip-)/.test(name) ||
    ['recall-all', 'blank-chosen', 'exchange', 'pass', 'bag-shake'].includes(name)) return 'Tiles & board'
  if (name.startsWith('ui-') ||
    ['page-flip', 'pencil-scribble', 'rank-reveal', 'player-joins', 'pause', 'resume', 'first-draw-reveal'].includes(name)) return 'Menus & notebook'
  if (name.startsWith('wheel-') ||
    ['word-valid', 'word-invalid', 'hint-ghost', 'dice-roll', 'penalty-cost', 'drop-out', 'gift-given', 'quit-nosave', 'buzzer'].includes(name)) return 'Words & penalties'
  if (['timer-tick', 'heartbeat', 'count-time-over', 'countdown-boom'].includes(name) ||
    /^count-(?:[1-9]|10)$/.test(name) || name.startsWith('male-')) return 'Timer'
  if (name.startsWith('burst-') || name === 'rumble-fanfare') return 'Bursts'
  if (name.startsWith('power-') || name === 'voice-power-up') return 'Power squares'
  if (['game-over-fanfare', 'high-score-ding', 'defeat-trombone'].includes(name)) return 'Game over'
  return 'Other'
}

function readFlags(): Flags {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('wr-soundboard') ?? '{}')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    const flags: Flags = {}
    for (const [name, value] of Object.entries(saved)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const row = value as Record<string, unknown>
        flags[name] = { bad: row.bad === true, note: typeof row.note === 'string' ? row.note : '' }
      }
    }
    return flags
  } catch { return {} }
}

function formatDb(value: number): string {
  return value.toFixed(1).replace('-', '−')
}

function SoundRow({ entry, flag, onFlag, onPlay, disabled }: {
  entry: SoundEntry
  flag: Flag
  onFlag: (name: string, update: Partial<Flag>) => void
  onPlay: (name: string) => void
  disabled: boolean
}) {
  const level = levelTable[entry.name]
  const target = level && targetLufs[level.group]
  const difference = level && target !== undefined ? level.lufs - target : 0
  const tone = difference > 3 ? 'hot' : difference < -3 ? 'quiet' : 'good'
  const width = level ? Math.max(0, Math.min(100, (level.lufs + 30) / 26 * 100)) : 0

  return (
    <div className={`soundboard__row${flag.bad ? ' soundboard__row--bad' : ''}`}>
      <div className="soundboard__name" title={entry.file}>
        <strong>{entry.name}</strong>
        {entry.custom && <span className="soundboard__custom">Custom</span>}
      </div>
      <button className="btn soundboard__play" type="button" onClick={() => onPlay(entry.name)} disabled={disabled} aria-label={`Play ${entry.name}`}>Play ▶</button>
      <div className="soundboard__loudness">
        <div className="soundboard__meter" role="img" aria-label={level ? `${formatDb(level.lufs)} LUFS; ${level.group} target ${target} LUFS` : 'No loudness data'}>
          <div className={`soundboard__meter-fill soundboard__meter-fill--${tone}`} style={{ width: `${width}%` }} />
          {target !== undefined && <span className="soundboard__meter-target" style={{ left: `${(target + 30) / 26 * 100}%` }} />}
        </div>
        <span className="soundboard__level">
          {level ? `${formatDb(level.lufs)} LUFS, peak ${formatDb(level.peakDb)}, gain ${formatDb(level.gainDb)} dB` : 'No loudness data'}
        </span>
      </div>
      <label className="soundboard__bad">
        <input type="checkbox" checked={flag.bad} onChange={(event) => onFlag(entry.name, { bad: event.target.checked })} />
        <span>Bad pick</span>
      </label>
      <input className="soundboard__note" type="text" value={flag.note} onChange={(event) => onFlag(entry.name, { note: event.target.value })} placeholder="Short note…" aria-label={`Note for ${entry.name}`} />
    </div>
  )
}

function Soundboard() {
  const [entries, setEntries] = useState<SoundEntry[]>([])
  const [flags, setFlags] = useState<Flags>(readFlags)
  const [filter, setFilter] = useState('')
  const [volume, setVolume] = useState(sfx.getVolume())
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [playingSection, setPlayingSection] = useState<Section | null>(null)
  const [fallback, setFallback] = useState('')
  const [toast, setToast] = useState('')
  const sequence = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([window.wordRumble.sounds.list(), sfx.init()])
      .then(([list]) => {
        if (!active) return
        setEntries(list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
        setReady(true)
      })
      .catch(() => { if (active) setLoadError('Could not load the sound list.') })
    return () => {
      active = false
      sequence.current++
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('wr-soundboard', JSON.stringify(flags)) } catch { /* Storage can be unavailable. */ }
  }, [flags])

  const grouped = useMemo(() => {
    const query = filter.trim().toLowerCase()
    const groups = new Map<Section, SoundEntry[]>()
    for (const section of sections) groups.set(section, [])
    for (const entry of entries) {
      const section = sectionFor(entry.name)
      if (!query || entry.name.includes(query) || section.toLowerCase().includes(query)) groups.get(section)!.push(entry)
    }
    return groups
  }, [entries, filter])

  function updateFlag(name: string, update: Partial<Flag>) {
    setFlags((current) => {
      const previous = current[name] ?? { bad: false, note: '' }
      return { ...current, [name]: { ...previous, ...update } }
    })
  }

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }

  async function playSection(section: Section, sounds: SoundEntry[]) {
    if (playingSection) {
      sequence.current++
      setPlayingSection(null)
      return
    }
    const run = ++sequence.current
    setPlayingSection(section)
    for (const [index, entry] of sounds.entries()) {
      if (sequence.current !== run) break
      sfx.play(entry.name, { varyPitch: false })
      if (index < sounds.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, (levelTable[entry.name]?.seconds ?? 0) * 1000 + 800))
      }
    }
    if (sequence.current === run) setPlayingSection(null)
  }

  async function copyNotes() {
    const notes: Record<string, string> = {}
    for (const [name, flag] of Object.entries(flags)) {
      if (flag.bad || flag.note.trim()) notes[name] = flag.note.trim() || 'bad'
    }
    const json = JSON.stringify(notes, null, 2)
    try {
      await navigator.clipboard.writeText(json)
      setFallback('')
      showToast(`Copied ${Object.keys(notes).length} sound notes.`)
    } catch {
      setFallback(json)
      showToast('Clipboard unavailable. Copy the JSON from the box below.')
    }
  }

  const visibleCount = [...grouped.values()].reduce((total, group) => total + group.length, 0)

  return (
    <main className="soundboard halftone-2">
      <header className="soundboard__header">
        <div>
          <p className="soundboard__eyebrow">Dev tools · audio review</p>
          <h1>Soundboard</h1>
          <p>Hear every sound, compare loudness, and mark the ones that need work.</p>
        </div>
        <div className="soundboard__controls">
          <label className="soundboard__volume">Volume <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); sfx.setVolume(value) }} /> <output>{Math.round(volume * 100)}%</output></label>
          <label className="soundboard__filter">Filter sounds <input type="search" value={filter} onChange={(event) => setFilter(event.target.value.toLowerCase())} placeholder="Name or section…" /></label>
        </div>
      </header>
      <div className="soundboard__list" aria-label="Sound list">
        {loadError && <p className="soundboard__message" role="alert">{loadError}</p>}
        {!ready && !loadError && <p className="soundboard__message">Loading sounds…</p>}
        {ready && visibleCount === 0 && <p className="soundboard__message">No sounds match your filter.</p>}
        {sections.map((section) => {
          const sounds = grouped.get(section)!
          if (!sounds.length) return null
          return (
            <section className="soundboard__section" key={section}>
              <div className="soundboard__section-head">
                <h2>{section} <span>{sounds.length}</span></h2>
                <button className="soundboard__section-play" type="button" onClick={() => void playSection(section, sounds)} disabled={!!playingSection && playingSection !== section}>
                  {playingSection === section ? 'Stop sequence ■' : 'Play whole section one after another (0.8 s gap) ▶'}
                </button>
              </div>
              <div className="soundboard__rows">
                {sounds.map((entry) => <SoundRow key={entry.name} entry={entry} flag={flags[entry.name] ?? { bad: false, note: '' }} onFlag={updateFlag} onPlay={(name) => sfx.play(name, { varyPitch: false })} disabled={!ready} />)}
              </div>
            </section>
          )
        })}
      </div>
      <footer className="soundboard__footer">
        <span>{visibleCount} of {entries.length} sounds · Bar scale −30 to −4 LUFS · Marker = group target</span>
        <button className="btn btn--pink soundboard__copy" type="button" onClick={() => void copyNotes()}>Copy my notes</button>
      </footer>
      {fallback && <div className="soundboard__fallback"><label htmlFor="soundboard-copy-fallback">Select and copy this JSON</label><textarea id="soundboard-copy-fallback" readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} /></div>}
      {toast && <div className="soundboard__toast" role="status">{toast}</div>}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Soundboard />)
