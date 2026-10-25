import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Board, DragLayer, Rack, useTileDrag } from '../components'
import { sfx } from '../audio/sfx'
import {
  isBlank, moveInList, orderRack, PLACEMENT_HINTS, previewPlay, reduce, shuffleIds, spinPenalty, wordsToCheck,
  type GameAction, type GameError, type GameState, type PenaltyOutcome, type Placement, type Tile
} from '../engine'
import { Handoff } from './Handoff'
import { BlankPicker, DefeatDialog, ExchangeDialog, PauseMenu, WordCheckDialog } from './game/Dialogs'
import './game/game.css'

export interface GameProps {
  game: GameState
  /** One colour per player: rack holder and the underline on tiles they played. */
  colors: string[]
  muted: boolean
  onToggleSound(): void
  /** The turn is over (after the short result banner). App decides who sees the screen next. */
  onTurnDone(next: GameState): void
  onSaveQuit(game: GameState): void
}

type Dialog =
  | null
  | { kind: 'blank'; tile: Tile; row: number; col: number }
  | { kind: 'exchange' }
  | { kind: 'defeat' }
  | { kind: 'words'; missing: string[] }

const SETTLE_MS = 1500

const ERRORS: Partial<Record<GameError, string>> = {
  'exchange-not-allowed': 'The bag is too low to swap tiles.',
  'bad-exchange': 'Pick at least one tile to swap.'
}

// Phase 11 replaces this with the spinning Penalty Wheel; until then the wheel is spun silently.
const PENALTY_TEXT: Record<PenaltyOutcome, string> = {
  half: 'Half points!', zero: 'Zero points!', minus10: '−10 from your total!', minus20: '−20 from your total!',
  gift: 'Points gifted away!', skip: 'You skip your next turn!', rackwipe: 'Rack wipe!', convince: 'They let it stand.', lucky: 'Lucky escape!'
}

function TurnTimer({ seconds, total }: { seconds: number; total: number }) {
  const fraction = Math.max(0, Math.min(1, seconds / total))
  const radius = 44
  const circumference = 2 * Math.PI * radius
  return (
    <div className={`wr-timer${seconds <= 10 ? ' is-low' : ''}`} role="timer" aria-label={`${seconds} seconds left`}>
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
      <span className="wr-timer__text">{seconds}</span>
    </div>
  )
}

export function Game({ game, colors, muted, onToggleSound, onTurnDone, onSaveQuit }: GameProps) {
  const solo = game.players.length === 1
  const me = game.players[game.current]
  const myColor = colors[game.current]
  const computerTurn = game.options.mode === 'computer' && game.current === 1
  const timerTotal = game.options.timerSeconds

  const [pending, setPending] = useState<Placement[]>([])
  const [order, setOrder] = useState<number[]>(() => me.rack.map((t) => t.id))
  const [selectedId, setSelectedId] = useState<number>()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [overlay, setOverlay] = useState<null | 'pause' | 'handoff'>(null)
  const [settle, setSettle] = useState<{ next: GameState; text: string; burst: string | null } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(computerTurn ? null : timerTotal)

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
  const preview = useMemo(() => previewPlay(game.board, pending), [game.board, pending])
  // Letters are visible only to the player whose turn it is, and only while nothing covers the screen.
  const hidden = overlay !== null || settle !== null || computerTurn
  const idle = dialog === null && overlay === null && settle === null && !busy

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
      line = `${record.rumble ? 'RUMBLE bonus! ' : ''}${gained >= 0 ? '+' : ''}${gained} points${record.penalty ? ` — ${PENALTY_TEXT[record.penalty]}` : ''}`
    }
    if (next.lastBurst) sfx.play('burst')
    if (record?.rumble) sfx.play('rumble-fanfare')
    sfx.play('flip-hide')
    setSettle({ next, text: line, burst: next.lastBurst?.text ?? null })
    return true
  }, [game, flash, onTurnDone])

  useEffect(() => {
    if (!settle) return
    const id = window.setTimeout(() => onTurnDone(settle.next), SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [settle, onTurnDone])

  // Placeholder opponent until Phase 13 teaches the computer to play.
  useEffect(() => {
    if (!computerTurn || settle) return
    const id = window.setTimeout(() => applyAction({ type: 'pass' }, 'Computer passed.'), 900)
    return () => window.clearTimeout(id)
  }, [computerTurn, settle, applyAction])

  useEffect(() => { if (!computerTurn) sfx.play('flip-see') }, [computerTurn])

  const recall = useCallback((quiet = false) => {
    setPending((current) => {
      if (current.length && !quiet) sfx.play('recall-all')
      return []
    })
    setSelectedId(undefined)
  }, [])

  // Speed timer: runs only while the player can actually play.
  useEffect(() => {
    if (remaining === null || !idle) return
    if (remaining <= 0) {
      sfx.play('buzzer')
      setDialog(null)
      recall(true)
      applyAction({ type: 'timeout' }, 'Too slow!')
      return
    }
    const id = window.setTimeout(() => {
      if (remaining <= 11) sfx.play('timer-tick')
      setRemaining(remaining - 1)
    }, 1000)
    return () => window.clearTimeout(id)
  }, [remaining, idle, recall, applyAction])

  const pause = useCallback(() => { sfx.play('pause'); setOverlay('pause') }, [])
  const resume = () => {
    sfx.play('resume')
    // Two players: the laptop may have changed hands, so back through "Let's go!".
    setOverlay(game.options.mode === 'two' ? 'handoff' : null)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (overlay === 'pause') resume()
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
    if (isBlank(tile) && !existing) { setDialog({ kind: 'blank', tile, row, col }); return }
    sfx.play('tile-place')
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

  const shuffleRack = () => {
    sfx.play('rack-shuffle')
    setOrder(shuffleIds(rackTiles))
  }

  // ------------------------------------------------------------------ turn buttons
  const commitPlay = (extra: { madeUp?: boolean } = {}) => {
    const action: Extract<GameAction, { type: 'play' }> = { type: 'play', placements: pending, ...extra }
    if (extra.madeUp && game.options.madeUp === 'penalty') {
      const spun = spinPenalty(solo)
      action.penalty = spun.outcome
      if (spun.outcome === 'convince') action.vote = 'keep'
    }
    setDialog(null)
    if (applyAction(action, 'Played!')) sfx.play('word-valid')
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
    commitPlay()
  }

  const doExchange = (ids: number[]) => {
    setDialog(null)
    recall(true)
    if (applyAction({ type: 'exchange', tileIds: ids }, `Swapped ${ids.length} ${ids.length === 1 ? 'tile' : 'tiles'}.`)) sfx.play('exchange')
  }

  const doPass = () => {
    if (!idle) return
    sfx.play('pass')
    recall(true)
    applyAction({ type: 'pass' }, 'Passed.')
  }

  const doConcede = () => {
    setDialog(null)
    sfx.play('defeat-trombone')
    applyAction({ type: 'concede' }, '')
  }

  // ------------------------------------------------------------------ view
  const canExchange = game.bag.length >= 7
  const score = preview.kind === 'ok' ? preview.score : null
  const others = game.players.map((p, i) => ({ p, i })).filter(({ i }) => i !== game.current)
  const style = { '--player': myColor } as CSSProperties

  return (
    <div className="wr-play halftone-2" style={style}>
      <div className="wr-play__board">
        <Board
          board={game.board}
          pending={pending}
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
        />
      </div>

      <aside className="wr-play__side">
        <header className="wr-play__status halftone-1">
          <h1 className="wr-play__turn">{computerTurn ? `${me.name} is thinking…` : `${me.name}'s turn`}</h1>
          {/* Hidden scores: only the player on turn ever sees a score, and only their own. */}
          {!hidden ? <p className="wr-play__score">Your score <strong>{me.score}</strong></p> : null}
          <p className="wr-play__bag">{game.bag.length} {game.bag.length === 1 ? 'tile' : 'tiles'} in the bag</p>
          {remaining !== null && timerTotal !== null && !computerTurn ? <TurnTimer seconds={remaining} total={timerTotal} /> : null}
        </header>

        <div className="wr-play__racks">
          {others.map(({ p, i }) => (
            <Rack key={i} owner={p.name} color={colors[i]} tiles={null} count={p.rack.length} faceDown />
          ))}
          <Rack
            owner={me.name}
            color={myColor}
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
        </div>

        <div className="wr-play__preview" aria-live="polite">
          {preview.kind === 'ok' && score ? (
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
            Play{score ? ` (${score.total})` : ''}
          </button>
          <button type="button" className="btn btn--aqua" disabled={!idle || pending.length === 0} onClick={() => recall()}>Recall</button>
          <button type="button" className="btn btn--aqua" disabled={!idle} onClick={shuffleRack}>Shuffle</button>
          <button
            type="button" className="btn btn--aqua" disabled={!idle || !canExchange}
            title={canExchange ? undefined : 'Needs at least 7 tiles in the bag'}
            onClick={() => { sfx.play('ui-click'); recall(true); setDialog({ kind: 'exchange' }) }}
          >
            Swap
          </button>
          <button type="button" className="btn btn--aqua" disabled={!idle} onClick={doPass}>Pass</button>
          <button type="button" className="btn" disabled={!idle} onClick={pause}>Pause</button>
          <button type="button" className="btn wr-play__defeat" disabled={!idle} onClick={() => { sfx.play('ui-click'); setDialog({ kind: 'defeat' }) }}>
            {solo ? 'End run' : 'Admit defeat'}
          </button>
        </div>
      </aside>

      <DragLayer tile={drag.tile} letter={pending.find((p) => p.tile.id === drag.tile?.id)?.letter} x={drag.x} y={drag.y} visible={drag.dragging} />

      {toast ? <div className="wr-play__toast" role="status">{toast}</div> : null}

      {settle ? (
        <div className="wr-play__settle" role="status">
          {settle.burst ? <p className="wr-play__burst">{settle.burst}</p> : null}
          <p className="wr-play__settle-text">{settle.text}</p>
        </div>
      ) : null}

      {dialog?.kind === 'blank' ? (
        <BlankPicker
          onCancel={() => setDialog(null)}
          onPick={(letter) => {
            const { tile, row, col } = dialog
            setDialog(null)
            sfx.play('tile-place')
            setPending((current) => [...current.filter((p) => p.tile.id !== tile.id), { row, col, tile, letter }])
            setSelectedId(undefined)
          }}
        />
      ) : null}
      {dialog?.kind === 'exchange' ? <ExchangeDialog rack={rackTiles} onExchange={doExchange} onCancel={() => setDialog(null)} /> : null}
      {dialog?.kind === 'defeat' ? <DefeatDialog solo={solo} onConfirm={doConcede} onCancel={() => setDialog(null)} /> : null}
      {dialog?.kind === 'words' ? (
        <WordCheckDialog
          missing={dialog.missing}
          madeUpAllowed={game.options.madeUp !== 'no'}
          onTakeBack={() => setDialog(null)}
          onLookUp={(word) => void window.wordRumble.openLookup(word)}
          onAdd={() => void addWordsAndPlay()}
          onMadeUp={() => commitPlay({ madeUp: true })}
        />
      ) : null}

      {overlay === 'pause' ? (
        <PauseMenu muted={muted} onResume={resume} onToggleSound={onToggleSound} onSaveQuit={() => onSaveQuit(game)} />
      ) : null}
      {overlay === 'handoff' ? <Handoff name={me.name} color={myColor} onGo={() => { setOverlay(null); sfx.play('flip-see') }} /> : null}
    </div>
  )
}
