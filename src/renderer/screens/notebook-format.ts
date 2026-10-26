export interface RecentPlayer {
  name: string
  score: number
  winner: boolean
}

export function formatNotebookDate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Date unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unknown'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

/** Names can contain colons, so take the score and winner fields from the right. */
export function parseRecentPlayers(value: unknown): RecentPlayer[] {
  if (typeof value !== 'string' || !value) return []
  return value.split('|').flatMap((entry) => {
    const winnerAt = entry.lastIndexOf(':')
    const scoreAt = entry.lastIndexOf(':', winnerAt - 1)
    if (winnerAt < 0 || scoreAt < 0) return []
    const name = entry.slice(0, scoreAt)
    const score = Number(entry.slice(scoreAt + 1, winnerAt))
    const winner = entry.slice(winnerAt + 1)
    if (!name || !Number.isFinite(score) || (winner !== '0' && winner !== '1')) return []
    return [{ name, score, winner: winner === '1' }]
  })
}

const penalties: Record<string, string> = {
  half: 'Half points', zero: 'Zero points', minus10: '−10 points', minus20: '−20 points',
  gift: 'Gift to opponent', skip: 'Skip a turn', rackwipe: 'Rack wipe',
  convince: 'Convince them!', lucky: 'Lucky escape'
}

export function penaltyLabel(value: unknown): string {
  if (value == null || value === '') return 'No penalty'
  return penalties[String(value)] ?? String(value)
}

/** A full group is five strokes; a partial group has one to four. */
export function tallyGroups(value: number | null): number[] {
  const count = Math.max(0, Math.floor(Number(value) || 0))
  return [...Array.from({ length: Math.floor(count / 5) }, () => 5), ...(count % 5 ? [count % 5] : [])]
}
