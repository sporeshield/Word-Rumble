import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

/** Local dictionary: ENABLE + extras + the family's custom words. Electron-free. */
export class WordService {
  private readonly set = new Set<string>()
  private readonly builtIn = new Set<string>()
  private readonly custom = new Set<string>()

  constructor(wordsDir: string, custom: Iterable<string> = []) {
    this.addLines(gunzipSync(readFileSync(join(wordsDir, 'enable.txt.gz'))).toString('utf8'))
    this.addLines(readFileSync(join(wordsDir, 'extras.txt'), 'utf8'))
    for (const w of this.set) this.builtIn.add(w)
    for (const w of custom) this.add(w)
  }

  private addLines(text: string): void {
    for (const line of text.split(/\r?\n/)) {
      const w = line.trim().toLowerCase()
      if (/^[a-z]+$/.test(w)) this.set.add(w)
    }
  }

  get size(): number {
    return this.set.size
  }

  has(word: string): boolean {
    return this.set.has(word.toLowerCase())
  }

  /** The subset of `words` not in the list (de-duplicated, lower-case). */
  missing(words: string[]): string[] {
    return [...new Set(words.map((w) => w.toLowerCase()))].filter((w) => !this.set.has(w))
  }

  add(word: string): void {
    const w = word.toLowerCase()
    this.set.add(w)
    if (!this.builtIn.has(w)) this.custom.add(w)
  }

  /** Forget every word the family added (built-in words stay). */
  clearCustom(): void {
    for (const w of this.custom) this.set.delete(w)
    this.custom.clear()
  }

  all(): string[] {
    return [...this.set]
  }
}
