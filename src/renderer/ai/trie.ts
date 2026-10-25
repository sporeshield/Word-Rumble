/**
 * Compact trie over A-Z words, stored in parallel arrays (first-child / next-sibling lists)
 * so the full 170k-word list stays small. Node 0 is the root.
 */
export class Trie {
  private letter: number[] = [-1]
  private firstChild: number[] = [-1]
  private nextSibling: number[] = [-1]
  private end: boolean[] = [false]

  readonly root = 0

  constructor(words: Iterable<string> = []) {
    for (const w of words) this.insert(w)
  }

  /** Add a word; anything that is not purely A-Z (after upper-casing) is ignored. */
  insert(word: string): void {
    const w = word.toUpperCase()
    if (!/^[A-Z]+$/.test(w)) return
    let node = this.root
    for (let i = 0; i < w.length; i++) {
      const code = w.charCodeAt(i) - 65
      let child = this.child(node, code)
      if (child < 0) {
        child = this.letter.length
        this.letter.push(code)
        this.firstChild.push(-1)
        this.nextSibling.push(this.firstChild[node])
        this.end.push(false)
        this.firstChild[node] = child
      }
      node = child
    }
    this.end[node] = true
  }

  /** Child of `node` for letter code 0-25, or -1. */
  child(node: number, code: number): number {
    for (let c = this.firstChild[node]; c >= 0; c = this.nextSibling[c]) {
      if (this.letter[c] === code) return c
    }
    return -1
  }

  /** First child of `node` (or -1); walk the rest with `next`. */
  first(node: number): number {
    return this.firstChild[node]
  }

  next(node: number): number {
    return this.nextSibling[node]
  }

  letterOf(node: number): number {
    return this.letter[node]
  }

  isEnd(node: number): boolean {
    return this.end[node]
  }

  has(word: string): boolean {
    const w = word.toUpperCase()
    if (w.length === 0) return false
    let node = this.root
    for (let i = 0; i < w.length; i++) {
      const code = w.charCodeAt(i) - 65
      if (code < 0 || code > 25) return false
      node = this.child(node, code)
      if (node < 0) return false
    }
    return this.end[node]
  }
}
