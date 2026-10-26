import { createBurstDecks, drawBurst, upgradeBurstDecks, type Burst, type BurstDecks, type BurstTier } from '../fx/bursts'
import { createBag, drawTiles, returnTiles } from './bag'
import { createBoard, PREMIUM_LAYOUT } from './board'
import { buildLayout, normalisePower, powerTotal, type PowerCounts } from './power'
import { validatePlacement } from './rules'
import { applyPlacements, scorePlay } from './scoring'
import { createTileSet, rackValue } from './tiles'
import { EXCHANGE_MIN_BAG, RACK_SIZE, type Board, type Placement, type PlacementError, type Premium, type Tile, type WordScore } from './types'
import { HINT_COST_MAX, HINT_COST_MIN, type PenaltyOutcome } from './penalties'

export type GameMode = 'solo' | 'two' | 'computer'
export type HintMode = 'off' | 'free' | 'penalty'
export type MadeUpMode = 'no' | 'free' | 'penalty'
/** Shuffle and Swap: free, or a random 1–10 point cost quoted first. Missing in old saves = free. */
export type CostMode = 'free' | 'penalty'

export interface GameOptions {
  mode: GameMode
  /** One name for solo, two otherwise. In `computer` mode player 1 is the computer. */
  names: string[]
  /** Seconds per turn, or null for no timer. */
  timerSeconds: number | null
  hints: HintMode
  madeUp: MadeUpMode
  shuffle?: CostMode
  swap?: CostMode
  /** Wild board: how many of each power square. Absent or all 0 = Classic board. */
  power?: PowerCounts
}

export interface PlayerState {
  name: string
  rack: Tile[]
  score: number
  rumbles: number
  hintsUsed: number
  hintPointsLost: number
  /** Absent in old saves = 0. */
  shufflePointsLost?: number
  swapPointsLost?: number
  madeUpCount: number
  penaltyCount: number
  conceded: boolean
  /** Dropped out (or conceded): skipped from then on. Absent in old saves = false. */
  out?: boolean
  /** Order of dropping out (1 = first); later drops rank higher. */
  outAt?: number
  /** Points handed to another player when dropping out. Absent = 0. */
  givenAway?: number
  /** Set by the "skip your next turn" slice; consumed when the turn would come round. */
  skipNext: boolean
}

export interface FirstDrawStep {
  player: number
  tile: Tile
}

export type TurnKind = 'play' | 'exchange' | 'pass' | 'timeout' | 'skipped' | 'dropped'

export interface TurnRecord {
  turn: number
  player: number
  kind: TurnKind
  words: WordScore[]
  /** Points the play was worth before any penalty. */
  rawScore: number
  /** Points the play itself added to the mover's total. */
  awarded: number
  rumble: boolean
  madeUp: boolean
  penalty: PenaltyOutcome | null
  /** Extra points the penalty took off the mover's total (negative or 0). */
  penaltyDelta: number
  /** Points handed to another player by the Gift slice (or by dropping out). */
  gifted: number
  /** Who received those points. Absent in old saves. */
  giftTo?: number
}

export type EndReason = 'out' | 'scoreless' | 'conceded' | 'finished'

export interface Adjustment {
  player: number
  delta: number
  label: string
}

export interface GameResult {
  reason: EndReason
  /** Sole winner (`ranking[0]` when single), or null for a shared first place and for a solo run. */
  winner: number | null
  conceder: number | null
  /** Places, best first; players who tie share a place. Dropped players come last (latest drop first). */
  ranking: number[][]
  /** Scores before end-of-game adjustments (the tie-break). */
  preAdjust: number[]
  adjustments: Adjustment[]
  finalScores: number[]
}

export interface GameState {
  options: GameOptions
  board: Board
  /** Square layout of this game (Classic, or Classic plus the power squares). Old saves lack it = Classic. */
  layout: Premium[][]
  /** Who laid each tile on the board, keyed `row,col` → player index (for the coloured underline). */
  owners: Record<string, number>
  bag: Tile[]
  players: PlayerState[]
  current: number
  turn: number
  phase: 'playing' | 'over'
  consecutiveScoreless: number
  /** Hint price quoted this turn ("penalty" mode); locked so declining and re-pressing cannot re-roll. */
  hint: { cost: number } | null
  /** Shuffle quote: locked until a shuffle is accepted (or the turn ends). Absent in old saves. */
  shuffle?: { cost: number } | null
  /** Swap quote: locked for the turn. */
  swap?: { cost: number } | null
  bursts: BurstDecks
  /** Burst produced by the most recent action (null when it produced none). */
  lastBurst: Burst | null
  firstDraw: FirstDrawStep[][]
  history: TurnRecord[]
  result: GameResult | null
}

export type GameError =
  | PlacementError
  | 'game-over'
  | 'tile-not-in-rack'
  | 'exchange-not-allowed'
  | 'bad-exchange'
  | 'made-up-not-allowed'
  | 'penalty-missing'
  | 'invalid-penalty'
  | 'vote-missing'
  | 'bad-recipient'
  | 'hints-off'
  | 'hint-not-offered'
  | 'not-solo'
  | 'bad-hint-cost'
  | 'shuffle-free'
  | 'shuffle-not-offered'
  | 'swap-free'
  | 'bad-swap-cost'

export type GameAction =
  /**
   * `recipient` (Gift) is required with 3+ players. `votes` (Convince) holds one vote from every other
   * active player; `vote` is the two-player shorthand for a single vote.
   */
  | {
      type: 'play'; placements: Placement[]; madeUp?: boolean; penalty?: PenaltyOutcome
      vote?: Vote; votes?: Vote[]; recipient?: number
    }
  /** `cost` is the quoted swap price; a locked quote wins, and the computer passes a freshly rolled one. */
  | { type: 'exchange'; tileIds: number[]; cost?: number }
  | { type: 'pass' }
  | { type: 'timeout' }
  /** Drop out. With 3+ players `recipient` gets the dropper's score (null/absent = nobody); two players ignore it. */
  | { type: 'concede'; recipient?: number | null }
  /** Solo only: end the run and subtract the leftover rack. */
  | { type: 'finish' }
  /** Price quote for a hint (the UI passes `rollHintCost()`); ignored if one is already locked this turn. */
  | { type: 'hint-offer'; cost: number }
  | { type: 'hint-accept' }
  | { type: 'hint-decline' }
  | { type: 'shuffle-offer'; cost: number }
  | { type: 'shuffle-accept' }
  | { type: 'swap-offer'; cost: number }

export type Vote = 'keep' | 'zero'

export type ReduceResult = { ok: true; state: GameState } | { ok: false; error: GameError }

const fail = (error: GameError): ReduceResult => ({ ok: false, error })
const succeed = (state: GameState): ReduceResult => ({ ok: true, state })

/** Consecutive scoreless turns that end the game: 6 for two players, 3 each for 3–4, 3 for a solo run. */
export const scorelessLimit = (playerCount: number): number => (playerCount === 1 ? 3 : playerCount === 2 ? 6 : 3 * playerCount)

const isActive = (p: PlayerState): boolean => !p.out
const activeCount = (state: GameState): number => state.players.filter(isActive).length

// ---------------------------------------------------------------- first-turn draw

const drawRank = (tile: Tile): number => (tile.letter === '?' ? -1 : tile.letter.charCodeAt(0))

/** Each player draws a tile; closest to A starts, a blank beats everything, ties redraw among the tied. */
export function drawForFirstTurn(playerCount: number): { rounds: FirstDrawStep[][]; starter: number } {
  let contenders = Array.from({ length: playerCount }, (_, i) => i)
  const rounds: FirstDrawStep[][] = []
  let bag = createBag(createTileSet())
  while (contenders.length > 1) {
    const drawn = drawTiles(bag, contenders.length)
    bag = drawn.bag
    const round = contenders.map((player, i) => ({ player, tile: drawn.drawn[i] }))
    rounds.push(round)
    const best = Math.min(...round.map((s) => drawRank(s.tile)))
    contenders = round.filter((s) => drawRank(s.tile) === best).map((s) => s.player)
  }
  return { rounds, starter: contenders[0] }
}

// ---------------------------------------------------------------- setup

const validPlayerCount = (mode: GameMode, count: number): boolean =>
  mode === 'solo' ? count === 1 : mode === 'computer' ? count === 2 : count >= 2 && count <= 4

/** Start a game: first-turn draw, then the full set is reshuffled and 7 tiles dealt to each player. */
export function createGame(options: GameOptions): GameState {
  if (!validPlayerCount(options.mode, options.names.length)) throw new Error('names does not match mode')
  const { rounds, starter } = drawForFirstTurn(options.names.length)
  let bag = createBag(createTileSet())
  const players: PlayerState[] = options.names.map((name) => {
    const dealt = drawTiles(bag, RACK_SIZE)
    bag = dealt.bag
    return {
      name, rack: dealt.drawn, score: 0, rumbles: 0, hintsUsed: 0, hintPointsLost: 0,
      shufflePointsLost: 0, swapPointsLost: 0,
      madeUpCount: 0, penaltyCount: 0, conceded: false, out: false, givenAway: 0, skipNext: false
    }
  })
  return {
    options, board: createBoard(), layout: options.power && powerTotal(options.power) > 0 ? buildLayout(options.power) : PREMIUM_LAYOUT,
    owners: {}, bag, players, current: starter, turn: 1, phase: 'playing',
    consecutiveScoreless: 0, hint: null, shuffle: null, swap: null, bursts: createBurstDecks(), lastBurst: null,
    firstDraw: rounds, history: [], result: null
  }
}

// ---------------------------------------------------------------- helpers

const patchPlayer = (state: GameState, index: number, patch: Partial<PlayerState>): PlayerState[] =>
  state.players.map((p, i) => (i === index ? { ...p, ...patch } : p))

function withBurst(state: GameState, tier: BurstTier | null): GameState {
  if (!tier) return { ...state, lastBurst: null }
  const { burst, decks } = drawBurst(state.bursts, tier)
  return { ...state, bursts: decks, lastBurst: burst }
}

const record = (state: GameState, partial: Partial<TurnRecord> & Pick<TurnRecord, 'kind'>): GameState => ({
  ...state,
  history: [...state.history, {
    turn: state.turn, player: state.current, words: [], rawScore: 0, awarded: 0, rumble: false,
    madeUp: false, penalty: null, penaltyDelta: 0, gifted: 0, ...partial
  }]
})

/** Places best first: active players by final score (pre-adjust breaks ties), then dropped players, latest drop first. */
function rankPlayers(players: PlayerState[], finalScores: number[], preAdjust: number[]): number[][] {
  const active = players.map((_, i) => i).filter((i) => isActive(players[i]))
  active.sort((a, b) => finalScores[b] - finalScores[a] || preAdjust[b] - preAdjust[a])
  const ranking: number[][] = []
  for (const i of active) {
    const last = ranking[ranking.length - 1]
    if (last && finalScores[last[0]] === finalScores[i] && preAdjust[last[0]] === preAdjust[i]) last.push(i)
    else ranking.push([i])
  }
  const dropped = players.map((_, i) => i).filter((i) => !isActive(players[i]))
  dropped.sort((a, b) => (players[b].outAt ?? 0) - (players[a].outAt ?? 0))
  for (const i of dropped) ranking.push([i])
  return ranking
}

/** Settle the game: apply end-of-game adjustments and decide the places. */
function endGame(state: GameState, reason: EndReason, opts: { out?: number; conceder?: number } = {}): GameState {
  const preAdjust = state.players.map((p) => p.score)
  const adjustments: Adjustment[] = []
  const n = state.players.length
  if (reason === 'out' && n > 1) {
    const out = opts.out!
    let gain = 0
    state.players.forEach((p, i) => {
      if (i === out || !isActive(p)) return
      const value = rackValue(p.rack)
      gain += value
      adjustments.push({ player: i, delta: -value, label: 'Tiles left on rack' })
    })
    adjustments.unshift({ player: out, delta: gain, label: 'Went out — got the leftover tiles' })
  } else if (reason !== 'conceded') {
    state.players.forEach((p, i) => {
      if (isActive(p)) adjustments.push({ player: i, delta: -rackValue(p.rack), label: 'Tiles left on rack' })
    })
  }
  const finalScores = preAdjust.map((s, i) => s + adjustments.filter((a) => a.player === i).reduce((t, a) => t + a.delta, 0))
  const ranking = rankPlayers(state.players, finalScores, preAdjust)
  const winner = n > 1 && ranking[0].length === 1 ? ranking[0][0] : null
  const players = state.players.map((p, i) => ({
    ...p, score: finalScores[i], conceded: p.conceded || opts.conceder === i
  }))
  return {
    ...state, players, phase: 'over', hint: null, shuffle: null, swap: null,
    result: { reason, winner, conceder: opts.conceder ?? null, ranking, preAdjust, adjustments, finalScores }
  }
}

/** Move to the next player (honouring "skip your next turn") and clear the per-turn hint lock. */
function advance(state: GameState): GameState {
  const n = state.players.length
  const following = (from: number): number => {
    let i = (from + 1) % n
    while (state.players[i].out && i !== from) i = (i + 1) % n
    return i
  }
  let next: GameState = { ...state, turn: state.turn + 1, current: following(state.current), hint: null, shuffle: null, swap: null }
  while (n > 1 && next.players[next.current].skipNext) {
    next = record({ ...next, players: patchPlayer(next, next.current, { skipNext: false }) }, { kind: 'skipped' })
    // A skipped turn is a scoreless turn too.
    next = { ...next, consecutiveScoreless: next.consecutiveScoreless + 1 }
    if (next.consecutiveScoreless >= scorelessLimit(activeCount(next))) return endGame(next, 'scoreless')
    next = { ...next, turn: next.turn + 1, current: following(next.current) }
  }
  return next
}

/** Close a turn: check the scoreless limit, then hand over. `scoreless` turns count toward the limit. */
function finishTurn(state: GameState, scoreless: boolean): GameState {
  const consecutiveScoreless = scoreless ? state.consecutiveScoreless + 1 : 0
  const next = { ...state, consecutiveScoreless }
  if (consecutiveScoreless >= scorelessLimit(activeCount(next))) return endGame(next, 'scoreless')
  return advance(next)
}

function burstTierForPlay(total: number, rumble: boolean, premiums: string[]): BurstTier | null {
  if (premiums.includes('PW10')) return 'powerword10'
  if (premiums.includes('PL10')) return 'power10'
  if (premiums.includes('PW5')) return 'powerword5'
  if (premiums.includes('QW')) return 'quad'
  if (premiums.includes('PL5')) return 'power5'
  const wordPremiums = premiums.filter((p) => p === 'TW' || p === 'DW' || p === 'START').length
  if (rumble || wordPremiums >= 2 || total >= 80) return 'top'
  if (premiums.includes('TW')) return 'tw'
  if (premiums.includes('DW') || premiums.includes('START')) return 'dw'
  if (premiums.includes('TL')) return 'tl'
  if (premiums.includes('DL')) return 'dl'
  return null
}

// ---------------------------------------------------------------- actions

function doPlay(state: GameState, action: Extract<GameAction, { type: 'play' }>): ReduceResult {
  const { placements } = action
  const player = state.players[state.current]
  const solo = state.players.length === 1
  const madeUp = action.madeUp === true
  const mode = state.options.madeUp

  if (madeUp && mode === 'no') return fail('made-up-not-allowed')
  let penalty: PenaltyOutcome | null = null
  if (madeUp && mode === 'penalty') {
    if (!action.penalty) return fail('penalty-missing')
    penalty = action.penalty
    const soloOnly = penalty === 'minus20'
    const duoOnly = penalty === 'gift' || penalty === 'convince'
    if ((solo && duoOnly) || (!solo && soloOnly)) return fail('invalid-penalty')
  }
  const others = state.players.map((_, i) => i).filter((i) => i !== state.current && isActive(state.players[i]))
  let giftTo: number | undefined
  let voteResult: Vote | undefined
  if (penalty === 'gift') {
    giftTo = action.recipient ?? (others.length === 1 ? others[0] : undefined)
    if (giftTo === undefined || !others.includes(giftTo)) return fail('bad-recipient')
  }
  if (penalty === 'convince') {
    const votes = action.votes ?? (action.vote ? [action.vote] : [])
    if (votes.length !== others.length) return fail('vote-missing')
    // A majority of "zero" wipes the play; a tie keeps it.
    voteResult = votes.filter((v) => v === 'zero').length > votes.length / 2 ? 'zero' : 'keep'
  }

  const rackById = new Map(player.rack.map((t) => [t.id, t]))
  const genuine = (t: Tile): boolean => {
    const owned = rackById.get(t.id)
    return !!owned && owned.letter === t.letter && owned.points === t.points
  }
  if (placements.some((p) => !genuine(p.tile))) return fail('tile-not-in-rack')
  const placed = validatePlacement(state.board, placements)
  if (!placed.ok) return fail(placed.error)

  const score = scorePlay(state.board, placements, placed.words, state.layout)
  const usedIds = new Set(placements.map((p) => p.tile.id))
  const board = applyPlacements(state.board, placements)
  const drawn = drawTiles(state.bag, usedIds.size)
  let rack = [...player.rack.filter((t) => !usedIds.has(t.id)), ...drawn.drawn]
  let bag = drawn.bag

  let awarded = score.total
  let penaltyDelta = 0
  let gifted = 0
  let skipNext = false
  switch (penalty) {
    case 'half': awarded = Math.floor(score.total / 2); break
    case 'zero': awarded = 0; break
    case 'minus10': penaltyDelta = -10; break
    case 'minus20': penaltyDelta = -20; break
    case 'gift': gifted = score.total; awarded = 0; break
    case 'skip': skipNext = !solo; break // nobody to skip past in a solo run
    case 'convince': if (voteResult === 'zero') awarded = 0; break
    case 'rackwipe':
      if (bag.length >= EXCHANGE_MIN_BAG) {
        // Forced exchange of the whole rack.
        const fresh = drawTiles(bag, RACK_SIZE)
        bag = returnTiles(fresh.bag, rack)
        rack = fresh.drawn
      } else penaltyDelta = -10
      break
    default: break
  }

  const players = state.players.map((p, i) => {
    if (i !== state.current) return gifted && i === giftTo ? { ...p, score: p.score + gifted } : p
    return {
      ...p, rack, score: p.score + awarded + penaltyDelta,
      rumbles: p.rumbles + (score.rumble ? 1 : 0),
      madeUpCount: p.madeUpCount + (madeUp ? 1 : 0),
      penaltyCount: p.penaltyCount + (penalty && penalty !== 'lucky' ? 1 : 0),
      skipNext: skipNext || p.skipNext
    }
  })

  const owners = { ...state.owners }
  for (const p of placements) owners[`${p.row},${p.col}`] = state.current
  let next: GameState = { ...state, board, owners, bag, players }
  next = record(next, {
    kind: 'play', words: score.words, rawScore: score.total, awarded, rumble: score.rumble,
    madeUp, penalty, penaltyDelta, gifted, ...(giftTo !== undefined ? { giftTo } : {})
  })
  next = withBurst(next, madeUp ? 'fibber' : burstTierForPlay(score.total, score.rumble, score.premiumsHit))

  if (bag.length === 0 && rack.length === 0) return succeed(endGame(next, 'out', { out: state.current }))
  return succeed(finishTurn(next, !solo && awarded === 0))
}

const validCost = (cost: unknown): cost is number =>
  typeof cost === 'number' && Number.isInteger(cost) && cost >= HINT_COST_MIN && cost <= HINT_COST_MAX

function doExchange(state: GameState, tileIds: number[], quoted?: number): ReduceResult {
  if (state.bag.length < EXCHANGE_MIN_BAG) return fail('exchange-not-allowed')
  const player = state.players[state.current]
  const ids = new Set(tileIds)
  if (ids.size === 0 || ids.size !== tileIds.length) return fail('bad-exchange')
  const give = player.rack.filter((t) => ids.has(t.id))
  if (give.length !== ids.size) return fail('bad-exchange')
  let cost = 0
  if (state.options.swap === 'penalty') {
    cost = state.swap?.cost ?? quoted ?? 0
    if (!validCost(cost)) return fail('bad-swap-cost')
  }
  const drawn = drawTiles(state.bag, give.length)
  const bag = returnTiles(drawn.bag, give)
  const rack = [...player.rack.filter((t) => !ids.has(t.id)), ...drawn.drawn]
  const next = record(
    {
      ...state, bag,
      players: patchPlayer(state, state.current, {
        rack, score: player.score - cost, swapPointsLost: (player.swapPointsLost ?? 0) + cost
      })
    },
    { kind: 'exchange', penaltyDelta: -cost }
  )
  return succeed(finishTurn(withBurst(next, null), state.players.length > 1))
}

/** Swap price quote: locked for the turn so declining and re-pressing shows the same number. */
function doSwapOffer(state: GameState, cost: number): ReduceResult {
  if (state.options.swap !== 'penalty') return fail('swap-free')
  if (!validCost(cost)) return fail('bad-swap-cost')
  return succeed({ ...state, swap: state.swap ?? { cost }, lastBurst: null })
}

/** The rack order is a UI matter; the engine only quotes and charges. A fresh quote is needed after each accepted shuffle. */
function doShuffle(state: GameState, action: Extract<GameAction, { type: 'shuffle-offer' | 'shuffle-accept' }>): ReduceResult {
  if (state.options.shuffle !== 'penalty') return fail('shuffle-free')
  if (action.type === 'shuffle-offer') {
    if (!validCost(action.cost)) return fail('bad-swap-cost')
    return succeed({ ...state, shuffle: state.shuffle ?? { cost: action.cost }, lastBurst: null })
  }
  if (!state.shuffle) return fail('shuffle-not-offered')
  const cost = state.shuffle.cost
  const player = state.players[state.current]
  return succeed({
    ...state, shuffle: null, lastBurst: null,
    players: patchPlayer(state, state.current, {
      score: player.score - cost, shufflePointsLost: (player.shufflePointsLost ?? 0) + cost
    })
  })
}

function doHint(state: GameState, action: GameAction): ReduceResult {
  if (state.options.hints === 'off') return fail('hints-off')
  const player = state.players[state.current]
  const free = state.options.hints === 'free'
  if (action.type === 'hint-offer') {
    if (!validCost(action.cost)) return fail('bad-hint-cost')
    // Locked for the turn: a second quote never changes the price.
    return succeed({ ...state, hint: free ? null : (state.hint ?? { cost: action.cost }), lastBurst: null })
  }
  if (action.type === 'hint-decline') return succeed({ ...state, lastBurst: null })
  if (free) {
    const next = { ...state, players: patchPlayer(state, state.current, { hintsUsed: player.hintsUsed + 1 }) }
    return succeed(withBurst(next, 'hint'))
  }
  if (!state.hint) return fail('hint-not-offered')
  const cost = state.hint.cost
  const next = {
    ...state, hint: null,
    players: patchPlayer(state, state.current, {
      score: player.score - cost, hintsUsed: player.hintsUsed + 1, hintPointsLost: player.hintPointsLost + cost
    })
  }
  return succeed(withBurst(next, 'hint'))
}

/** Drop out. Two players: the other wins as before. 3–4: score goes to the chosen player, rack to the bag, play carries on. */
function doConcede(state: GameState, recipient: number | null): ReduceResult {
  const conceder = state.current
  const n = state.players.length
  const base = { ...state, lastBurst: null }
  if (n === 1) return succeed(endGame(base, 'finished', { conceder }))
  const outAt = state.players.filter((p) => p.out).length + 1
  if (n === 2) {
    return succeed(endGame({ ...base, players: patchPlayer(base, conceder, { out: true, outAt }) }, 'conceded', { conceder }))
  }
  const dropper = state.players[conceder]
  if (recipient !== null && (recipient === conceder || !state.players[recipient] || state.players[recipient].out)) {
    return fail('bad-recipient')
  }
  const given = recipient !== null ? dropper.score : 0
  const players = state.players.map((p, i) => {
    if (i === conceder) return { ...p, rack: [], out: true, outAt, conceded: true, givenAway: given, score: p.score - given }
    return i === recipient ? { ...p, score: p.score + given } : p
  })
  let next: GameState = { ...base, players, bag: returnTiles(state.bag, dropper.rack) }
  next = record(next, { kind: 'dropped', gifted: given, ...(recipient !== null ? { giftTo: recipient } : {}) })
  if (activeCount(next) === 1) return succeed(endGame(next, 'conceded', { conceder }))
  // The limit shrinks with the table: the existing silent turns may already be enough.
  if (next.consecutiveScoreless >= scorelessLimit(activeCount(next))) return succeed(endGame(next, 'scoreless'))
  return succeed(advance(next))
}

/** Fill in the fields older saves lack (drop-outs, ranking) so a saved game can continue. */
export function normaliseGame(state: GameState): GameState {
  const players = state.players.map((p) => ({
    ...p, out: p.out ?? false, givenAway: p.givenAway ?? 0,
    shufflePointsLost: p.shufflePointsLost ?? 0, swapPointsLost: p.swapPointsLost ?? 0
  }))
  let result = state.result
  if (result && !result.ranking) {
    // Old results: the conceder of a conceded game ranks last.
    const c = result.reason === 'conceded' ? result.conceder : null
    const ranked = players.map((p, i) => (i === c ? { ...p, out: true, outAt: p.outAt ?? 1 } : p))
    result = { ...result, ranking: rankPlayers(ranked, result.finalScores, result.preAdjust) }
  }
  return {
    ...state, players, shuffle: state.shuffle ?? null, swap: state.swap ?? null, result,
    layout: state.layout ?? PREMIUM_LAYOUT, bursts: upgradeBurstDecks(state.bursts),
    options: state.options.power ? { ...state.options, power: normalisePower(state.options.power) } : state.options
  }
}

/** The one entry point for every game action. Pure apart from crypto shuffles of the bag. */
export function reduce(state: GameState, action: GameAction): ReduceResult {
  if (state.phase === 'over') return fail('game-over')
  switch (action.type) {
    case 'play': return doPlay(state, action)
    case 'exchange': return doExchange(state, action.tileIds, action.cost)
    case 'pass':
      return succeed(finishTurn(withBurst(record(state, { kind: 'pass' }), null), true))
    case 'timeout':
      return succeed(finishTurn(withBurst(record(state, { kind: 'timeout' }), 'timeout'), true))
    case 'concede': return doConcede(state, action.recipient ?? null)
    case 'finish':
      if (state.players.length !== 1) return fail('not-solo')
      return succeed(endGame({ ...state, lastBurst: null }, 'finished'))
    case 'hint-offer':
    case 'hint-accept':
    case 'hint-decline':
      return doHint(state, action)
    case 'shuffle-offer':
    case 'shuffle-accept':
      return doShuffle(state, action)
    case 'swap-offer':
      return doSwapOffer(state, action.cost)
  }
}
