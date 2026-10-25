import { MoveFinder } from './client'

let finder: Promise<MoveFinder> | null = null

/** One move-finder worker for the whole app (hints now, the computer opponent in Phase 13). */
export function getFinder(): Promise<MoveFinder> {
  finder ??= window.wordRumble.words.all().then((words) => new MoveFinder(words))
  return finder
}

/** Make a word the players added legal for later hint / computer searches. */
export function teachFinder(words: string[]): void {
  if (finder) void finder.then((f) => f.addWords(words))
}
