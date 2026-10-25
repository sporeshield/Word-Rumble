// Sound manager: every sound in resources/sounds (and sounds/custom overrides) by name.
// Callers use names from scripts/sound-map.mjs, e.g. sfx.play('tile-place').
// Group names pick a random variant: 'burst' plays any burst-* file, 'burst-zap' any burst-zap-N.

export interface PlayOptions {
  /** 0-1, multiplied with the master volume. */
  gain?: number
  /** Set false for sounds that should always play at their natural pitch. */
  varyPitch?: boolean
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
  private loading: Promise<void> | null = null
  private volume = 0.8
  private muted = false

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
          if (!buffer && entry.custom) {
            const builtIn = list.find((e) => e.name === entry.name && !e.custom)
            bytes = builtIn ? await window.wordRumble.sounds.read(builtIn.file, false) : null
            buffer = bytes ? await this.decode(bytes) : null
          }
          if (buffer) this.buffers.set(entry.name, buffer)
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
  getVolume(): number { return this.volume }
  isMuted(): boolean { return this.muted }

  play(name: string, options: PlayOptions = {}): void {
    if (!this.ctx || !this.master || this.muted) return
    const chosen = pickSound([...this.buffers.keys()], name)
    if (!chosen) return
    // The audio context starts suspended until the first user gesture.
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const source = this.ctx.createBufferSource()
    source.buffer = this.buffers.get(chosen)!
    if (options.varyPitch !== false) source.playbackRate.value = 0.94 + Math.random() * 0.12
    const gain = this.ctx.createGain()
    gain.gain.value = options.gain ?? 1
    source.connect(gain).connect(this.master)
    source.start()
  }
}

export const sfx = new Sfx()
