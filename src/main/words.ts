import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

/** Local dictionary: ENABLE + extras + the family's custom words. Electron-free. */
export class WordService {
  private readonly set = new Set<string>()

  constructor(wordsDir: string, custom: Iterable<string> = []) {
    this.addLines(gunzipSync(readFileSync(join(wordsDir, 'enable.txt.gz'))).toString('utf8'))
    this.addLines(readFileSync(join(wordsDir, 'extras.txt'), 'utf8'))
    for (const w of custom) this.set.add(w.toLowerCase())
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
    this.set.add(word.toLowerCase())
  }

  all(): string[] {
    return [...this.set]
  }
}
