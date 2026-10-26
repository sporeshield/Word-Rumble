// Sound manager: every sound in resources/sounds (and sounds/custom overrides) by name.
// Callers use names from scripts/sound-map.mjs, e.g. sfx.play('tile-place').
// Group names pick a random variant: 'burst' plays any burst-* file, 'burst-zap' any burst-zap-N.

import levels from './levels.json'

/** Loudness-matching gain (linear) for a built-in sound; made by scripts/studio/levels.mjs. 1 when unknown. */
export function levelGain(name: string, table: Record<string, { gainDb: number }> = levels): number {
  const entry = table[name]
  return entry ? 10 ** (entry.gainDb / 20) : 1
}

export interface PlayOptions {
  /** 0-1, multiplied with the master volume. */
  gain?: number
  /** Set false for sounds that should always play at their natural pitch. */
  varyPitch?: boolean
  /** Fixed playback rate (no random pitch), e.g. for a speeding heartbeat. */
  rate?: number
}

export type Voice = 'female' | 'male' | 'off'

/** Spoken sounds: the Settings voice choice picks the `male-` set or silences them. */
export const VOICED_SOUNDS: readonly string[] = [
  ...Array.from({ length: 10 }, (_, i) => `count-${i + 1}`), 'count-time-over', 'voice-power-up',
]

/** The sound name to play for `name` under the chosen voice; null means stay silent. */
export function voicedName(name: string, voice: Voice, names: ReadonlySet<string>): string | null {
  if (!VOICED_SOUNDS.includes(name)) return name
  if (voice === 'off') return null
  return voice === 'male' && names.has(`male-${name}`) ? `male-${name}` : name
}

/** Names matching `name` exactly, or `name-<something>` (a group such as 'burst-zap'). */
export function matchingSounds(names: Iterable<string>, name: string): string[] {
  const out: string[] = []
  for (const n of names) if (n === name || n.startsWith(`${name}-`)) out.push(n)
  return out
}

/** Exact name wins; otherwise a random member of the group. */
export function pickSound(names: string[], name: string, random: () => number = Math.random): string | null {
  if (names.includes(name)) return name
  const group = matchingSounds(names, name)
  return group.length ? group[Math.floor(random() * group.length)] : null
}

class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  /** Sounds loaded from sounds/custom: the user's own loudness, so no matching gain. */
  private custom = new Set<string>()
  private loading: Promise<void> | null = null
  private volume = 0.8
  private muted = false
  private voice: Voice = 'female'

  /** Preload everything. Safe to call more than once. */
  init(): Promise<void> {
    this.loading ??= this.load()
    return this.loading
  }

  private async load(): Promise<void> {
    try {
      this.ctx = new window.AudioContext()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.applyVolume()
      const list = await window.wordRumble.sounds.list()
      await Promise.all(list.map(async (entry) => {
        try {
          let bytes = await window.wordRumble.sounds.read(entry.file, entry.custom)
          let buffer = bytes ? await this.decode(bytes) : null
          // A broken custom file falls back to the built-in sound of the same name.
          let fellBack = false
          if (!buffer && entry.custom) {
            fellBack = true
            const builtIn = list.find((e) => e.name === entry.name && !e.custom)
            bytes = builtIn ? await window.wordRumble.sounds.read(builtIn.file, false) : null
            buffer = bytes ? await this.decode(bytes) : null
          }
          if (buffer) {
            this.buffers.set(entry.name, buffer)
            if (entry.custom && !fellBack) this.custom.add(entry.name)
          }
        } catch { /* a missing sound must never break the game */ }
      }))
    } catch { /* no audio device: stay silent */ }
  }

  private async decode(bytes: Uint8Array): Promise<AudioBuffer | null> {
    try {
      // decodeAudioData detaches its input, so give it its own copy.
      return await this.ctx!.decodeAudioData(bytes.slice().buffer)
    } catch { return null }
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume
  }

  setVolume(v: number): void { this.volume = Math.min(1, Math.max(0, v)); this.applyVolume() }
  setMuted(m: boolean): void { this.muted = m; this.applyVolume() }
  setVoice(v: Voice): void { this.voice = v }
  getVoice(): Voice { return this.voice }
  getVolume(): number { return this.volume }
  isMuted(): boolean { return this.muted }

  play(name: string, options: PlayOptions = {}): void {
    if (!this.ctx || !this.master || this.muted) return
    const heard = voicedName(name, this.voice, new Set(this.buffers.keys()))
    if (!heard) return
    const chosen = pickSound([...this.buffers.keys()], heard)
    if (!chosen) return
    // The audio context starts suspended until the first user gesture.
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const source = this.ctx.createBufferSource()
    source.buffer = this.buffers.get(chosen)!
    if (options.rate !== undefined) source.playbackRate.value = options.rate
    else if (options.varyPitch !== false) source.playbackRate.value = 0.94 + Math.random() * 0.12
    const gain = this.ctx.createGain()
    gain.gain.value = (options.gain ?? 1) * (this.custom.has(chosen) ? 1 : levelGain(chosen))
    source.connect(gain).connect(this.master)
    source.start()
  }
}

export const sfx = new Sfx()
