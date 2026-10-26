import type { RecentGamePlayer } from '../../shared/api'

export function formatNotebookDate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Date unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unknown'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

/** The `players` list of a Recent Games row (already ordered by place); anything malformed is dropped. */
export function recentPlayers(value: unknown): RecentGamePlayer[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((p: Partial<RecentGamePlayer> | null) => {
    if (!p || typeof p.name !== 'string' || !p.name || !Number.isFinite(p.score) || !Number.isFinite(p.rank)) return []
    return [{
      name: p.name, isComputer: !!p.isComputer, score: Number(p.score), rank: Number(p.rank), winner: !!p.winner,
      conceded: !!p.conceded, givenAway: Number(p.givenAway) || 0, giftTo: typeof p.giftTo === 'string' ? p.giftTo : null
    }]
  })
}

/** "Shane won", "Shane & Dawn tied", "It's a draw!" (everyone level) or "Shane's run" (solo). */
export function recentHeadline(players: RecentGamePlayer[]): string {
  if (!players.length) return 'Game over'
  if (players.length === 1) return `${players[0].name}'s run`
  const first = players.filter((p) => p.rank === 1)
  if (first.length === 1) return `${first[0].name} won`
  if (first.length === players.length) return "It's a draw!"
  return `${first.map((p) => p.name).join(' & ')} tied`
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

export function placeLabel(rank: number): string {
  return rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`
}

/** "dropped out — gave 42 to Dawn" for a player who left a 3–4 player game; empty otherwise. */
export function dropNote(player: RecentGamePlayer): string {
  if (!player.conceded) return ''
  return player.givenAway > 0 && player.giftTo ? `dropped out — gave ${player.givenAway} to ${player.giftTo}` : 'dropped out'
}
