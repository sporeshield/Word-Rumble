import type { GameRecord, Row } from '../../shared/api'
import type { GameState } from '../engine/game'
import type { SetupConfig } from './types'

/** Turn a finished game into the row set the DB stores (scores, plays, Hall of Shame counters). */
export function buildGameRecord(game: GameState, setup: SetupConfig, playedAt = new Date().toISOString()): GameRecord {
  const result = game.result
  if (!result) throw new Error('game is not over')
  const isComputer = (i: number) => game.options.mode === 'computer' && i === 1
  const ranks = placeNumbers(result.ranking, game.players.length)
  const dropGiftTo = (i: number): string | null => {
    const to = game.history.find((t) => t.kind === 'dropped' && t.player === i)?.giftTo
    return to === undefined ? null : game.players[to]?.name ?? null
  }
  return {
    mode: game.options.mode,
    difficulty: game.options.mode === 'computer' ? setup.difficulty : null,
    timer: game.options.timerSeconds,
    options: { hints: game.options.hints, madeUp: game.options.madeUp, shuffle: game.options.shuffle ?? 'free', swap: game.options.swap ?? 'free' },
    endedReason: result.reason,
    playedAt,
    players: game.players.map((p, i) => ({
      name: p.name,
      isComputer: isComputer(i),
      finalScore: result.finalScores[i],
      preAdjustScore: result.preAdjust[i],
      rumbles: p.rumbles,
      hintsUsed: p.hintsUsed,
      hintPointsLost: p.hintPointsLost,
      shufflePointsLost: p.shufflePointsLost ?? 0,
      swapPointsLost: p.swapPointsLost ?? 0,
      madeUpCount: p.madeUpCount,
      conceded: p.conceded || result.conceder === i,
      winner: result.winner === i,
      rank: ranks[i],
      givenAway: p.givenAway ?? 0,
      giftTo: dropGiftTo(i)
    })),
    plays: game.history
      .filter((t) => t.kind === 'play')
      .map((t) => ({
        playerIndex: t.player,
        words: t.words.map((w) => w.text),
        score: t.awarded,
        rumble: t.rumble,
        madeUp: t.madeUp,
        penalty: t.penalty
      }))
  }
}

/** Place number per seat from the engine's ranking; a shared place skips the next ones (1, 1, 3). */
export function placeNumbers(ranking: number[][], players: number): number[] {
  const out = Array.from({ length: players }, () => players)
  let place = 1
  for (const group of ranking) {
    for (const i of group) out[i] = place
    place += group.length
  }
  return out
}

/**
 * Which players beat the stored top scores of this mode (computed from the list read *before* recording).
 * A score earns the stamp if it would make the top `limit` and is above zero. Computers never count.
 */
export function newHighScores(
  game: GameState,
  topBefore: Row[],
  limit = 10
): boolean[] {
  const result = game.result
  if (!result) return game.players.map(() => false)
  const scores = topBefore.map((r) => Number(r.score)).sort((a, b) => b - a)
  const cutoff = scores.length < limit ? 0 : scores[limit - 1]
  return game.players.map((_, i) => {
    if (game.options.mode === 'computer' && i === 1) return false
    if (result.conceder === i || game.players[i].conceded) return false
    const s = result.finalScores[i]
    return s > 0 && s > cutoff
  })
}
