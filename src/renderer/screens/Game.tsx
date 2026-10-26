import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Board, DragLayer, GhostTiles, Rack, useTileDrag } from '../components'
import { ComicBurst, Confetti } from '../fx'
import type { BurstTier } from '../fx/bursts'
import { computerAction } from '../ai/choose'
import { getFinder, teachFinder } from '../ai/shared'
import type { Difficulty, RackSide } from './types'
import { sfx } from '../audio/sfx'
import {
  isBlank, isPowerPremium, moveInList, orderRack, penaltySlices, PLACEMENT_HINTS, previewPlay, reduce, rollHintCost, rollPenaltyCost, shuffleIds, spinPenalty, wordsToCheck,
  type GameAction, type GameError, type GameState, type PenaltyOutcome, type Placement, type Tile, type Vote
} from '../engine'
import { Handoff } from './Handoff'
import { BlankPicker, DefeatDialog, ExchangeDialog, PauseMenu, WordCheckDialog } from './game/Dialogs'
import { CostQuoteDialog } from './game/CostDialog'
import { HintOfferDialog, NoHintDialog } from './game/HintDialog'
import { countdownStage } from './game/countdown'
import { PenaltyWheel } from './game/PenaltyWheel'
import { VoteDialog } from './game/VoteDialog'
import { RecipientDialog } from './game/PlayerDialogs'
import './game/game.css'
import './game/countdown.css'

export interface GameProps {
  game: GameState
  /** One colour per player: rack holder and the underline on tiles they played. */
  colors: string[]
  muted: boolean
  /** Strength of the computer opponent (vs Computer mode only). */
  difficulty: Difficulty
  /** Which side of the board the upright rack stands on (whole game). */
  rackSide?: RackSide
  onToggleSound(): void
  /** The turn is over (after the short result banner). App decides who sees the screen next. */
  onTurnDone(next: GameState): void
  /** Seconds left on this turn's timer when the game was saved (Continue resumes from it). */
  resumeSeconds?: number
  onSaveQuit(game: GameState, secondsLeft: number | null): void
  onQuitNoSave(): void
  /** Tests only: start with tiles already on the board and/or a dialog open. */
  testStart?: { pending?: Placement[]; dialog?: Dialog }
}

export type Dialog =
  | null
  | { kind: 'blank'; tile: Tile; row: number; col: number }
  | { kind: 'exchange' }
  | { kind: 'shuffle'; cost: number; rolling: boolean }
  | { kind: 'swapquote'; cost: number; rolling: boolean }
  | { kind: 'defeat' }
  | { kind: 'words'; missing: string[] }
  | { kind: 'wheel'; action: PlayAction; index: number; outcome: PenaltyOutcome; word: string }
  | { kind: 'recipient'; action: PlayAction }
  | { kind: 'vote'; action: PlayAction; word: string; voters: number[]; votes: Vote[] }
  | { kind: 'hint'; cost: number | null; rolling: boolean }
  | { kind: 'nohint' }

type PlayAction = Extract<GameAction, { type: 'play' }>

/** Square colour key: the classic types, then the Wild power types that are on this board (with their counts). */
const SQUARE_KEY = [
  { id: 'dl', premium: 'DL', swatch: '×2', label: 'letter' },
  { id: 'tl', premium: 'TL', swatch: '×3', label: 'letter' },
  { id: 'dw', premium: 'DW', swatch: '×2', label: 'WORD' },
  { id: 'tw', premium: 'TW', swatch: '×3', label: 'WORD' },
  { id: 'start', premium: 'START', swatch: '★', label: 'start' },
  { id: 'pl5', premium: 'PL5', swatch: '×5', label: 'POWER letter', power: true },
  { id: 'pl10', premium: 'PL10', swatch: '×10', label: 'POWER letter', power: true },
  { id: 'qw', premium: 'QW', swatch: '×4', label: 'WORD', power: true },
  { id: 'pw5', premium: 'PW5', swatch: '×5', label: 'POWER WORD', power: true },
  { id: 'pw10', premium: 'PW10', swatch: '×10', label: 'POWER WORD', power: true }
] as const

const REVEAL_MS = 2600
const POWER_TIERS: readonly BurstTier[] = ['power5', 'power10', 'quad', 'powerword5', 'powerword10']

const SETTLE_MS = 1500
const BOOM_MS = 1600

const ERRORS: Partial<Record<GameError, string>> = {
  'exchange-not-allowed': 'The bag is too low to swap tiles.',
  'bad-exchange': 'Pick at least one tile to swap.'
}

const PENALTY_TEXT: Record<PenaltyOutcome, string> = {
  half: 'Half points!', zero: 'Zero points!', minus10: '−10 from your total!', minus20: '−20 from your total!',
  gift: 'Points gifted away!', skip: 'You skip your next turn!', rackwipe: 'Rack wipe!', convince: 'They let it stand.', lucky: 'Lucky escape!'
}

function TurnTimer({ seconds, total }: { seconds: number; total: number }) {
  const fraction = Math.max(0, Math.min(1, seconds / total))
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const stage = countdownStage(seconds)
  const level = stage.kind === 'nervous' ? stage.level : stage.kind === 'boom' ? 10 : 0
  return (
    <div
      className={`wr-timer${level ? ' is-low is-nervous' : ''}`}
      style={level ? ({ '--wr-level': level } as CSSProperties) : undefined}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="wr-timer__track" cx="50" cy="50" r={radius} />
        <circle
          className="wr-timer__ring"
          cx="50" cy="50" r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span key={seconds} className="wr-timer__text">{seconds}</span>
    </div>
  )
}

export function Game({ game: initialGame, colors, muted, difficulty, rackSide = 'left', onToggleSound, onTurnDone, resumeSeconds, onSaveQuit, onQuitNoSave, testStart }: GameProps) {
  // Local copy: hint quotes and costs change the game state mid-turn, before the turn ends.
  const [game, setGame] = useState(initialGame)
  const solo = game.players.length === 1
  const me = game.players[game.current]
  const myColor = colors[game.current]
  const computerTurn = game.options.mode === 'computer' && game.current === 1
  const timerTotal = game.options.timerSeconds

  const [pending, setPending] = useState<Placement[]>(testStart?.pending ?? [])
  const [order, setOrder] = useState<number[]>(() => me.rack.map((t) => t.id))
  const [selectedId, setSelectedId] = useState<number>()
  const [dialog, setDialog] = useState<Dialog>(testStart?.dialog ?? null)
  const [overlay, setOverlay] = useState<null | 'pause' | 'handoff'>(null)
  const [settle, setSettle] = useState<{ next: GameState; text: string; burst: { text: string; tier: BurstTier } | null } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ghost, setGhost] = useState<Placement[]>([])
  const [fxBurst, setFxBurst] = useState<{ text: string; tier: BurstTier } | null>(null)
  const hintCount = useRef(0)
  const [remaining, setRemaining] = useState<number | null>(computerTurn ? null : resumeSeconds ?? timerTotal)
  const [boom, setBoom] = useState(false)
  // Start of a Wild game: the power squares flash while the burst and voice announce them.
  const wild = game.layout.some((row) => row.some(isPowerPremium))
  const [reveal, setReveal] = useState(() => wild && game.turn === 1 && game.history.length === 0 && resumeSeconds === undefined && !testStart)
  // Nervous level 1–10 while the last ten seconds run on a human turn (drives the vignette).
  const stageNow = remaining !== null && !computerTurn ? countdownStage(remaining) : null
  const nervous = stageNow?.kind === 'nervous' && overlay === null ? stageNow.level : 0

  const flash = useCallback((text: string) => {
    setToast(text)
    window.setTimeout(() => setToast((current) => (current === text ? null : current)), 2600)
  }, [])

  // ------------------------------------------------------------------ derived
  const pendingIds = useMemo(() => new Set(pending.map((p) => p.tile.id)), [pending])
  const rackTiles = useMemo(
    () => orderRack(order, me.rack.filter((t) => !pendingIds.has(t.id))),
    [order, me.rack, pendingIds]
  )
  // Squares of each power type on this board (only the types that are actually here get a key entry).
  const keyEntries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of game.layout) for (const p of row) if (isPowerPremium(p)) counts.set(p, (counts.get(p) ?? 0) + 1)
    return SQUARE_KEY.filter((k) => !('power' in k) || counts.has(k.premium)).map((k) => ({ ...k, count: counts.get(k.premium) ?? 0 }))
  }, [game.layout])
  const preview = useMemo(() => previewPlay(game.board, pending, game.layout), [game.board, pending, game.layout])
  // Letters are visible only to the player whose turn it is, and only while nothing covers the screen.
  // `secret` covers the dialogs another player may be looking at (wheel, recipient, drop-out, each voter's turn):
  // there the pending tiles, the live preview and the Play button's points leave the DOM too.
  const secret = overlay !== null || dialog?.kind === 'wheel' || dialog?.kind === 'recipient' || dialog?.kind === 'vote' || dialog?.kind === 'defeat'
  const hidden = secret || settle !== null || computerTurn
  const idle = dialog === null && overlay === null && settle === null && !busy && !boom

  // ------------------------------------------------------------------ actions
  const applyAction = useCallback((action: GameAction, text: string) => {
    const result = reduce(game, action)
    if (!result.ok) {
      flash(ERRORS[result.error] ?? PLACEMENT_HINTS[result.error as keyof typeof PLACEMENT_HINTS] ?? 'That did not work.')
      return false
    }
    const next = result.state
    if (next.phase === 'over') { onTurnDone(next); return true }
    const record = next.history[game.history.length]
    let line = text
    if (record?.kind === 'play') {
      const gained = record.awarded + record.penaltyDelta
      // Hidden scores: a computer mover's points are never shown.
      line = computerTurn ? 'Computer played a word.' : `${record.rumble ? 'RUMBLE bonus! ' : ''}${gained >= 0 ? '+' : ''}${gained} points${record.penalty ? ` — ${PENALTY_TEXT[record.penalty]}` : ''}`
    }
    // A play on power squares gets loud random pool sounds instead of the normal burst sound — never the type.
    const annoy = record?.kind === 'play' ? next.lastAnnoy ?? [] : []
    if (annoy.length) annoy.forEach((name, i) => window.setTimeout(() => sfx.play(name, { varyPitch: false }), i * 450))
    else if (next.lastBurst) sfx.play('burst')
    setGhost([])
    if (record?.rumble) sfx.play('rumble-fanfare')
    sfx.play('flip-hide')
    setSettle({ next, text: line, burst: next.lastBurst ? { text: next.lastBurst.text, tier: next.lastBurst.tier } : null })
    return true
  }, [game, flash, onTurnDone])

  useEffect(() => {
    if (!settle) return
    const id = window.setTimeout(() => onTurnDone(settle.next), SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [settle, onTurnDone])

  // Computer opponent: search in the worker, pause so it feels like thinking, then act.
  const applyRef = useRef(applyAction)
  applyRef.current = applyAction
  useEffect(() => {
    if (!computerTurn || settle) return
    const started = Date.now()
    let cancelled = false
    let timer: number | undefined
    const act = (action: GameAction) => {
      if (cancelled) return
      const text = action.type === 'exchange' ? 'Computer swapped tiles.' : 'Computer passed.'
      // The computer pays the same rolled swap cost, silently.
      const final = action.type === 'exchange' && game.options.swap === 'penalty' ? { ...action, cost: rollPenaltyCost() } : action
      timer = window.setTimeout(() => applyRef.current(final, text), Math.max(0, 1200 - (Date.now() - started)))
    }
    getFinder()
      .then((finder) => finder.find(game.board, me.rack, undefined, game.layout))
      .then((moves) => act(computerAction(game, moves, difficulty)))
      .catch(() => act({ type: 'pass' }))
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [computerTurn, settle, game, me.rack, difficulty])

  useEffect(() => { if (!computerTurn) sfx.play('flip-see') }, [computerTurn])

  useEffect(() => {
    if (!reveal) return
    sfx.play('power-reveal')
    sfx.play('voice-power-up')
    setFxBurst({ text: 'POWER SQUARES ARE LIVE!', tier: 'power10' })
    const id = window.setTimeout(() => setReveal(false), REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [reveal])

  const recall = useCallback((quiet = false) => {
    setPending((current) => {
      if (current.length && !quiet) sfx.play('recall-all')
      return []
    })
    setSelectedId(undefined)
  }, [])

  // Speed timer: runs only while the player can actually play. The last 10 seconds are the nervous countdown.
  useEffect(() => {
    if (remaining === null || !idle) return
    if (remaining <= 0) {
      // BOOM!!: shake and flash, then the usual timeout once the bang has landed.
      setBoom(true)
      sfx.play('countdown-boom')
      sfx.play('burst-boom-1')
      sfx.play('count-time-over')
      return
    }
    const id = window.setTimeout(() => {
      const next = remaining - 1
      const stage = countdownStage(next)
      if (stage.kind === 'nervous') {
        sfx.play('heartbeat', { rate: stage.heartbeatRate })
        sfx.play(stage.voiceSound)
      }
      setRemaining(next)
    }, 1000)
    return () => window.clearTimeout(id)
  }, [remaining, idle, recall])

  useEffect(() => {
    if (!boom) return
    const id = window.setTimeout(() => {
      setBoom(false)
      setDialog(null)
      recall(true)
      applyRef.current({ type: 'timeout' }, 'Too slow!')
    }, BOOM_MS)
    return () => window.clearTimeout(id)
  }, [boom, recall])

  const pause = useCallback(() => { sfx.play('pause'); setOverlay('pause') }, [])
  const resume = (viaKeyboard = false) => {
    sfx.play('resume')
    // Friends (2–4): the laptop may have changed hands, so back through "Let's go!".
    // Escape-Escape is the same person at the keyboard, so it goes straight back.
    setOverlay(game.options.mode === 'two' && !viaKeyboard ? 'handoff' : null)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (overlay === 'pause') resume(true)
      else if (idle) pause()
      else if (dialog && dialog.kind !== 'blank') setDialog(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ------------------------------------------------------------------ placing tiles
  const placeAt = (tile: Tile, row: number, col: number) => {
    if (game.board[row]?.[col]) return
    const occupant = pending.find((p) => p.row === row && p.col === col)
    if (occupant && occupant.tile.id !== tile.id) return
    const existing = pending.find((p) => p.tile.id === tile.id)
    setGhost([])
    if (isBlank(tile) && !existing) { setDialog({ kind: 'blank', tile, row, col }); return }
    sfx.play('tile-place')
    // One neutral chime for any power square, so even a preview does not give the type away.
    if (isPowerPremium(game.layout[row]?.[col])) sfx.play('power-preview')
    setPending((current) => [...current.filter((p) => p.tile.id !== tile.id), { row, col, tile, letter: existing?.letter ?? tile.letter }])
    setSelectedId(undefined)
  }

  const returnToRack = (tile: Tile, index?: number) => {
    sfx.play('tile-return')
    setPending((current) => current.filter((p) => p.tile.id !== tile.id))
    if (index !== undefined) {
      const ids = rackTiles.map((t) => t.id)
      ids.splice(Math.max(0, Math.min(ids.length, index)), 0, tile.id)
      setOrder(ids)
    }
  }

  const drag = useTileDrag(({ tile, source }, target) => {
    if (!idle) return
    if (target.kind === 'square') placeAt(tile, target.row, target.col)
    else if (target.kind === 'rack') {
      if (source.kind === 'rack') {
        sfx.play('rack-reorder')
        setOrder(moveInList(rackTiles.map((t) => t.id), source.index, target.index))
      } else returnToRack(tile, target.index)
    }
  })

  const reorder = (from: number, to: number) => {
    sfx.play('rack-reorder')
    setOrder(moveInList(rackTiles.map((t) => t.id), from, to))
  }

  const doShuffle = () => {
    sfx.play('rack-shuffle')
    setOrder(shuffleIds(rackTiles))
  }

  const shuffleRack = () => {
    if (!idle) return
    if (game.options.shuffle !== 'penalty') { doShuffle(); return }
    sfx.play('ui-click')
    const quoted = reduce(game, { type: 'shuffle-offer', cost: rollPenaltyCost() })
    if (!quoted.ok) { flash('Shuffle is not available.'); return }
    setGame(quoted.state)
    setDialog({ kind: 'shuffle', cost: quoted.state.shuffle?.cost ?? 0, rolling: !game.shuffle })
  }

  const acceptShuffle = () => {
    const paid = reduce(game, { type: 'shuffle-accept' })
    setDialog(null)
    if (!paid.ok) { flash('That shuffle was not available.'); return }
    setGame(paid.state)
    doShuffle()
  }

  const openSwap = () => {
    if (!idle) return
    sfx.play('ui-click')
    recall(true)
    if (game.options.swap !== 'penalty') { setDialog({ kind: 'exchange' }); return }
    const quoted = reduce(game, { type: 'swap-offer', cost: rollPenaltyCost() })
    if (!quoted.ok) { flash('Swap is not available.'); return }
    setGame(quoted.state)
    setDialog({ kind: 'swapquote', cost: quoted.state.swap?.cost ?? 0, rolling: !game.swap })
  }

  // ------------------------------------------------------------------ turn buttons
  const finishPlay = (action: PlayAction) => {
    setDialog(null)
    if (applyAction(action, 'Played!')) sfx.play('word-valid')
  }

  const commitPlay = (extra: { madeUp?: boolean; missing?: string[] } = {}) => {
    const action: PlayAction = { type: 'play', placements: pending, ...(extra.madeUp ? { madeUp: true } : {}) }
    if (extra.madeUp && game.options.madeUp === 'penalty') {
      const spun = spinPenalty(solo)
      action.penalty = spun.outcome
      setDialog({ kind: 'wheel', action, index: spun.index, outcome: spun.outcome, word: extra.missing?.[0] ?? '' })
      return
    }
    finishPlay(action)
  }

  const submit = async () => {
    if (!idle) return
    if (preview.kind !== 'ok') {
      flash(preview.kind === 'invalid' ? PLACEMENT_HINTS[preview.error] : PLACEMENT_HINTS['no-tiles'])
      return
    }
    setBusy(true)
    try {
      const missing = await window.wordRumble.words.check(wordsToCheck(preview.words))
      if (missing.length === 0) commitPlay()
      else { sfx.play('word-invalid'); setDialog({ kind: 'words', missing }) }
    } finally {
      setBusy(false)
    }
  }

  const addWordsAndPlay = async () => {
    if (dialog?.kind !== 'words') return
    const results = await Promise.all(dialog.missing.map((w) => window.wordRumble.words.add(w)))
    if (results.some((ok) => !ok)) { flash('Words can only use the letters A to Z.'); return }
    sfx.play('word-valid')
    teachFinder(dialog.missing)
    commitPlay()
  }

  const doExchange = (ids: number[]) => {
    setDialog(null)
    recall(true)
    if (applyAction({ type: 'exchange', tileIds: ids }, `Swapped ${ids.length} ${ids.length === 1 ? 'tile' : 'tiles'}${game.options.swap === 'penalty' && game.swap ? ` (−${game.swap.cost})` : ''}.`)) sfx.play('exchange')
  }

  const doPass = () => {
    if (!idle) return
    sfx.play('pass')
    recall(true)
    applyAction({ type: 'pass' }, 'Passed.')
  }

  const askHint = () => {
    if (!idle) return
    sfx.play('ui-click')
    recall(true)
    const free = game.options.hints === 'free'
    const quoted = reduce(game, { type: 'hint-offer', cost: game.hint?.cost ?? rollHintCost() })
    if (!quoted.ok) { flash('Hints are not available.'); return }
    setGame(quoted.state)
    setDialog({ kind: 'hint', cost: free ? null : quoted.state.hint?.cost ?? null, rolling: !game.hint })
  }

  const declineHint = () => {
    const declined = reduce(game, { type: 'hint-decline' })
    if (declined.ok) setGame(declined.state)
    setDialog(null)
  }

  const acceptHint = async () => {
    setDialog(null)
    setBusy(true)
    try {
      const moves = await (await getFinder()).find(game.board, me.rack, undefined, game.layout)
      if (moves.length === 0) { setDialog({ kind: 'nohint' }); return }
      const taken = reduce(game, { type: 'hint-accept' })
      if (!taken.ok) { flash('That hint was not available.'); return }
      setGame(taken.state)
      const move = moves[hintCount.current++ % moves.length]
      setGhost(move.placements)
      if (taken.state.lastBurst) setFxBurst({ text: taken.state.lastBurst.text, tier: taken.state.lastBurst.tier })
    } catch {
      flash('The hint helper could not start.')
    } finally {
      setBusy(false)
    }
  }

  const activeOthers = useMemo(
    () => game.players.map((p, i) => ({ p, i })).filter(({ p, i }) => i !== game.current && !p.out),
    [game.players, game.current]
  )
  const seatChoices = (list: typeof activeOthers) => list.map(({ p, i }) => ({ index: i, name: p.name, color: colors[i] }))

  const doConcede = (recipient?: number | null) => {
    setDialog(null)
    sfx.play(game.players.length > 2 ? 'drop-out' : 'defeat-trombone')
    applyAction(recipient === undefined ? { type: 'concede' } : { type: 'concede', recipient }, '')
  }

  // Wheel landed: Gift asks who gets the points (automatic with one other), Convince collects private votes.
  const afterWheel = (current: Extract<NonNullable<Dialog>, { kind: 'wheel' }>) => {
    if (current.outcome === 'gift' && activeOthers.length > 1) setDialog({ kind: 'recipient', action: current.action })
    else if (current.outcome === 'convince') {
      // The computer never votes by hand: it lets the word stand.
      const voters = activeOthers.filter(({ i }) => !(game.options.mode === 'computer' && i === 1)).map(({ i }) => i)
      if (voters.length === 0) finishPlay({ ...current.action, votes: activeOthers.map(() => 'keep' as Vote) })
      else setDialog({ kind: 'vote', action: current.action, word: current.word, voters, votes: [] })
    } else finishPlay(current.action)
  }

  const castVote = (current: Extract<NonNullable<Dialog>, { kind: 'vote' }>, vote: Vote) => {
    const votes = [...current.votes, vote]
    if (votes.length < current.voters.length) setDialog({ ...current, votes })
    else finishPlay({ ...current.action, votes: [...votes, ...activeOthers.slice(votes.length).map(() => 'keep' as Vote)] })
  }

  // ------------------------------------------------------------------ view
  const canExchange = game.bag.length >= 7
  const score = preview.kind === 'ok' ? preview.score : null
  const others = game.players.map((p, i) => ({ p, i })).filter(({ i }) => i !== game.current)
  const style = { '--player': myColor } as CSSProperties

  return (
    <div className={`wr-play wr-play--rack-${rackSide} halftone-2${boom ? ' is-booming' : ''}${reveal ? ' is-power-reveal' : ''}${settle?.burst && POWER_TIERS.includes(settle.burst.tier) ? ' is-kablam' : ''}`} style={style}>
      <div className="wr-play__board">
        <Board
          board={game.board}
          layout={secret ? undefined : game.layout}
          pending={secret ? [] : pending}
          hoverSquare={drag.hoverSquare}
          onSquareClick={(row, col) => {
            if (!idle || selectedId === undefined) return
            const tile = rackTiles.find((t) => t.id === selectedId)
            if (tile) placeAt(tile, row, col)
          }}
          onPendingPointerDown={idle ? (placement, event) => drag.startDrag(placement.tile, { kind: 'pending', row: placement.row, col: placement.col }, event) : undefined}
          onPendingClick={idle ? (placement) => { if (!drag.wasDragged) returnToRack(placement.tile) } : undefined}
          playedBy={(row, col) => {
            const owner = game.owners[`${row},${col}`]
            return owner === undefined ? undefined : colors[owner]
          }}
        >
          {ghost.length && !secret ? <GhostTiles placements={ghost} /> : null}
        </Board>
      </div>

      <section className="wr-play__rack" aria-label="Your tiles">
        <Rack
          owner={me.name}
          color={myColor}
          upright
          tiles={hidden ? null : rackTiles}
          count={hidden ? me.rack.length - pending.length : rackTiles.length}
          faceDown={hidden}
          selectedId={selectedId}
          onTilePointerDown={idle ? (tile, event) => drag.startDrag(tile, { kind: 'rack', index: rackTiles.findIndex((t) => t.id === tile.id) }, event) : undefined}
          onTileClick={idle ? (tile) => {
            if (drag.wasDragged) return
            sfx.play('tile-pickup')
            setSelectedId((current) => (current === tile.id ? undefined : tile.id))
          } : undefined}
          onReorder={idle ? reorder : undefined}
        />
      </section>

      <aside className="wr-play__side">
        <header className="wr-play__status halftone-1">
          <p className="wr-play__now">▶ {computerTurn ? 'THINKING' : 'PLAYING NOW'}</p>
          <h1 className="wr-play__turn">{computerTurn ? `${me.name} is thinking…` : `${me.name}'s turn`}</h1>
          <div className="wr-play__score-row">
            {/* Hidden scores: only the player on turn ever sees a score, and only their own. */}
            {!hidden ? <p className="wr-play__score">Your score <strong>{me.score}</strong></p> : null}
            <p className="wr-play__bag">{game.bag.length} {game.bag.length === 1 ? 'tile' : 'tiles'} in the bag</p>
          </div>
          {remaining !== null && timerTotal !== null && !computerTurn ? <TurnTimer seconds={remaining} total={timerTotal} /> : null}
        </header>

        {others.length ? (
          <section className="wr-play__players halftone-3" aria-label="Other players">
            <h2 className="wr-play__section-title">Players <span className="wr-play__subtitle">· other racks</span></h2>
            <div className="wr-play__plates">
              {/* Counts only: other players' letters and scores never reach the DOM. */}
              {others.map(({ p, i }) => (
                <div className={`wr-play__plate${p.out ? ' wr-play__plate--out' : ''}`} key={i} style={{ '--plate': colors[i] } as CSSProperties}>
                  <span className="wr-play__plate-back" aria-hidden="true" />
                  <strong>{p.name}</strong>
                  <span className="wr-play__plate-count">{p.out ? 'dropped out' : `${p.rack.length} ${p.rack.length === 1 ? 'tile' : 'tiles'}`}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="wr-play__key" aria-label="Square colour key">
          <h2 className="wr-play__section-title">Square key</h2>
          <div className="wr-play__legend">
            {keyEntries.map((k) => (
              <div className={`wr-play__legend-item wr-play__legend-item--${k.id}${'power' in k ? ' wr-play__legend-item--power' : ''}`} key={k.id}>
                <span className="wr-play__legend-swatch">{k.swatch}</span><span>{k.label}{'power' in k ? <em className="wr-play__legend-count"> · {k.count} on board</em> : null}</span>
              </div>
            ))}
          </div>
        </section>


        <div className="wr-play__preview" aria-live="polite">
          {secret ? null : preview.kind === 'ok' && score ? (
            <>
              <p className="wr-play__preview-total">{score.total} points{score.rumble ? ' — RUMBLE!' : ''}</p>
              <p className="wr-play__preview-words">{score.words.map((w) => `${w.text} ${w.score}`).join(' · ')}</p>
            </>
          ) : preview.kind === 'invalid' ? (
            <p className="wr-play__preview-hint">{PLACEMENT_HINTS[preview.error]}</p>
          ) : (
            <p className="wr-play__preview-hint">Drag tiles onto the board, or click a tile and then a square.</p>
          )}
        </div>

        <div className="wr-play__buttons">
          <button type="button" className="btn btn--pink wr-play__go" disabled={!idle || pending.length === 0} onClick={() => void submit()}>
            Play{score && !secret ? ` (${score.total})` : ''}
          </button>
          <button type="button" className="btn btn--aqua" disabled={!idle || pending.length === 0} onClick={() => recall()}>Recall</button>
          <button type="button" className="btn btn--aqua" disabled={!idle} onClick={shuffleRack}>Shuffle</button>
          <button
            type="button" className="btn btn--aqua" disabled={!idle || !canExchange}
            title={canExchange ? undefined : 'Needs at least 7 tiles in the bag'}
            onClick={openSwap}
          >
            Swap
          </button>
          <button type="button" className="btn btn--aqua" disabled={!idle} onClick={doPass}>Pass</button>
          {game.options.hints !== 'off' ? (
            <button type="button" className="btn btn--aqua" disabled={!idle} onClick={askHint}>Hint</button>
          ) : null}
          <button type="button" className="btn" disabled={!idle} onClick={pause}>Pause</button>
          <button type="button" className="btn wr-play__defeat" disabled={!idle} onClick={() => { sfx.play('ui-click'); setDialog({ kind: 'defeat' }) }}>
            {solo ? 'End run' : game.players.length > 2 ? 'Drop out' : 'Admit defeat'}
          </button>
        </div>
      </aside>

      <DragLayer tile={drag.tile} letter={pending.find((p) => p.tile.id === drag.tile?.id)?.letter} x={drag.x} y={drag.y} visible={drag.dragging} />

      {toast ? <div className="wr-play__toast" role="status">{toast}</div> : null}

      {settle ? (
        <div className="wr-play__settle" role="status">
          <p className="wr-play__settle-text">{settle.text}</p>
        </div>
      ) : null}

      {settle?.burst ? <ComicBurst text={settle.burst.text} tier={settle.burst.tier} /> : null}
      {settle?.burst && POWER_TIERS.includes(settle.burst.tier) && !computerTurn ? <Confetti pieces={90} duration={1800} /> : null}
      {nervous ? <div className="wr-vignette" style={{ '--wr-level': nervous } as CSSProperties} aria-hidden="true" /> : null}
      {boom ? <div className="wr-boom" aria-hidden="true"><div className="wr-boom__flash" /><span className="wr-boom__text">BOOM!!</span></div> : null}
      {fxBurst ? <ComicBurst text={fxBurst.text} tier={fxBurst.tier} onDone={() => setFxBurst(null)} /> : null}

      {dialog?.kind === 'hint' ? (
        <HintOfferDialog cost={dialog.cost} rolling={dialog.rolling} onAccept={() => void acceptHint()} onDecline={declineHint} />
      ) : null}
      {dialog?.kind === 'nohint' ? <NoHintDialog onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'wheel' ? (
        <PenaltyWheel
          slices={[...penaltySlices(solo)]}
          landingIndex={dialog.index}
          solo={solo}
          onLanded={() => afterWheel(dialog)}
        />
      ) : null}
      {dialog?.kind === 'recipient' ? (
        <RecipientDialog
          title="Who gets the points?"
          text="The wheel says gift! Pick the player who gets this play's points."
          label="Who gets the points"
          seats={seatChoices(activeOthers)}
          onPick={(index) => { if (index !== null) finishPlay({ ...dialog.action, recipient: index }) }}
        />
      ) : null}
      {dialog?.kind === 'vote' ? (
        <VoteDialog
          key={dialog.votes.length}
          playerName={game.players[dialog.voters[dialog.votes.length]].name}
          color={colors[dialog.voters[dialog.votes.length]]}
          word={dialog.word}
          position={{ number: dialog.votes.length + 1, of: dialog.voters.length }}
          onVote={(vote) => castVote(dialog, vote)}
        />
      ) : null}

      {dialog?.kind === 'blank' ? (
        <BlankPicker
          onCancel={() => setDialog(null)}
          onPick={(letter) => {
            const { tile, row, col } = dialog
            setDialog(null)
            sfx.play('tile-place')
            if (isPowerPremium(game.layout[row]?.[col])) sfx.play('power-preview')
            setPending((current) => [...current.filter((p) => p.tile.id !== tile.id), { row, col, tile, letter }])
            setSelectedId(undefined)
          }}
        />
      ) : null}
      {dialog?.kind === 'shuffle' ? (
        <CostQuoteDialog kind="shuffle" cost={dialog.cost} rolling={dialog.rolling} onAccept={acceptShuffle} onDecline={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'swapquote' ? (
        <CostQuoteDialog kind="swap" cost={dialog.cost} rolling={dialog.rolling} onAccept={() => setDialog({ kind: 'exchange' })} onDecline={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'exchange' ? <ExchangeDialog rack={rackTiles} cost={game.options.swap === 'penalty' ? game.swap?.cost ?? null : null} onExchange={doExchange} onCancel={() => setDialog(null)} /> : null}
      {dialog?.kind === 'defeat' && game.players.length > 2 ? (
        <RecipientDialog
          title="Drop out?"
          text="You're out for the rest of the game. Pick who gets your points, or nobody."
          label="Drop out"
          seats={seatChoices(activeOthers)}
          allowNobody
          onPick={(index) => doConcede(index)}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'defeat' && game.players.length <= 2 ? <DefeatDialog solo={solo} onConfirm={() => doConcede()} onCancel={() => setDialog(null)} /> : null}
      {dialog?.kind === 'words' ? (
        <WordCheckDialog
          missing={dialog.missing}
          madeUpAllowed={game.options.madeUp !== 'no'}
          onTakeBack={() => setDialog(null)}
          onLookUp={(word) => void window.wordRumble.openLookup(word)}
          onAdd={() => void addWordsAndPlay()}
          onMadeUp={() => commitPlay({ madeUp: true, missing: dialog.missing })}
        />
      ) : null}

      {overlay === 'pause' ? (
        <PauseMenu muted={muted} onResume={() => resume()} onToggleSound={onToggleSound} onSaveQuit={() => onSaveQuit(game, remaining)} onQuitNoSave={onQuitNoSave} />
      ) : null}
      {overlay === 'handoff' ? <Handoff name={me.name} color={myColor} onGo={() => { setOverlay(null); sfx.play('flip-see') }} /> : null}
    </div>
  )
}
