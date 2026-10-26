import type { GameRecord, Row } from '../../shared/api'
import type { GameState } from '../engine/game'
import type { SetupConfig } from './types'

/** Turn a finished game into the row set the DB stores (scores, plays, Hall of Shame counters). */
export function buildGameRecord(game: GameState, setup: SetupConfig, playedAt = new Date().toISOString()): GameRecord {
  const result = game.result
  if (!result) throw new Error('game is not over')
  const isComputer = (i: number) => game.options.mode === 'computer' && i === 1
  return {
    mode: game.options.mode,
    difficulty: game.options.mode === 'computer' ? setup.difficulty : null,
    timer: game.options.timerSeconds,
    options: { hints: game.options.hints, madeUp: game.options.madeUp },
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
      madeUpCount: p.madeUpCount,
      conceded: result.conceder === i,
      winner: result.winner === i
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
    if (result.conceder === i) return false
    const s = result.finalScores[i]
    return s > 0 && s > cutoff
  })
}
