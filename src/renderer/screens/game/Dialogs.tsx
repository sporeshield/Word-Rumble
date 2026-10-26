import { useState, type ReactNode } from 'react'
import { Tile } from '../../components'
import { sfx } from '../../audio/sfx'
import type { Tile as GameTile } from '../../engine'

const click = () => sfx.play('ui-click')

function Dialog({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <div className="wr-dlg" role="alertdialog" aria-label={label}>
      <div className="wr-dlg__box">
        <h2 className="wr-dlg__title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

export function BlankPicker({ onPick, onCancel }: { onPick(letter: string): void; onCancel(): void }) {
  return (
    <Dialog title="Which letter is the blank?" label="Pick a letter for the blank tile">
      <div className="wr-dlg__letters">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            className="wr-dlg__letter"
            onMouseEnter={() => sfx.play('ui-hover')}
            onClick={() => { sfx.play('blank-chosen'); onPick(letter) }}
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="wr-dlg__row">
        <button type="button" className="btn btn--aqua" onClick={() => { click(); onCancel() }}>Never mind</button>
      </div>
    </Dialog>
  )
}

export function ExchangeDialog({ rack, onExchange, onCancel }: { rack: GameTile[]; onExchange(ids: number[]): void; onCancel(): void }) {
  const [chosen, setChosen] = useState<number[]>([])
  const toggle = (id: number) => {
    sfx.play('ui-toggle')
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }
  return (
    <Dialog title="Swap tiles" label="Choose tiles to exchange">
      <p className="wr-dlg__text">Pick the tiles to put back in the bag. You score nothing this turn.</p>
      <div className="wr-dlg__tiles">
        {rack.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className={`wr-dlg__tile${chosen.includes(tile.id) ? ' is-chosen' : ''}`}
            aria-pressed={chosen.includes(tile.id)}
            onClick={() => toggle(tile.id)}
          >
            <Tile tile={tile} state={chosen.includes(tile.id) ? 'selected' : 'board'} />
          </button>
        ))}
      </div>
      <div className="wr-dlg__row">
        <button type="button" className="btn btn--aqua" onClick={() => { click(); onCancel() }}>Cancel</button>
        <button
          type="button"
          className="btn btn--pink"
          disabled={chosen.length === 0}
          onClick={() => onExchange(chosen)}
        >
          Swap {chosen.length || ''} {chosen.length === 1 ? 'tile' : 'tiles'}
        </button>
      </div>
    </Dialog>
  )
}

export interface WordCheckProps {
  missing: string[]
  /** Setup allows made-up words (free or with the Penalty Wheel). */
  madeUpAllowed: boolean
  onTakeBack(): void
  onLookUp(word: string): void
  onAdd(): void
  onMadeUp(): void
}

export function WordCheckDialog({ missing, madeUpAllowed, onTakeBack, onLookUp, onAdd, onMadeUp }: WordCheckProps) {
  return (
    <Dialog title="Hmm, not in our word list…" label="Word not found">
      <ul className="wr-dlg__words">
        {missing.map((word) => (
          <li key={word}>
            <span className="wr-dlg__word">{word.toUpperCase()}</span>
            <button type="button" className="wr-dlg__link" onClick={() => { click(); onLookUp(word) }}>Look it up</button>
          </li>
        ))}
      </ul>
      <div className="wr-dlg__stack">
        <button type="button" className="btn btn--aqua" onClick={() => { click(); onTakeBack() }}>Take it back</button>
        <button type="button" className="btn" onClick={() => { click(); onAdd() }}>It's real — add to our word list</button>
        {madeUpAllowed ? (
          <button type="button" className="btn btn--pink" onClick={() => { click(); onMadeUp() }}>Play it as a made-up word</button>
        ) : null}
      </div>
    </Dialog>
  )
}

export function DefeatDialog({ solo, onConfirm, onCancel }: { solo: boolean; onConfirm(): void; onCancel(): void }) {
  return (
    <Dialog title={solo ? 'End this run?' : 'Admit defeat?'} label="Admit defeat">
      <p className="wr-dlg__text">
        {solo ? 'Your run ends now and the score you have is written in the notebook.' : 'The game ends right now and the other side wins, whatever the scores say.'}
      </p>
      <div className="wr-dlg__row">
        <button type="button" className="btn btn--aqua" onClick={() => { click(); onCancel() }}>Keep playing</button>
        <button type="button" className="btn btn--pink" onClick={onConfirm}>{solo ? 'End the run' : 'I give up'}</button>
      </div>
    </Dialog>
  )
}

export interface PauseMenuProps {
  muted: boolean
  onResume(): void
  onToggleSound(): void
  onSaveQuit(): void
  onQuitNoSave(): void
}

export function PauseMenu({ muted, onResume, onToggleSound, onSaveQuit, onQuitNoSave }: PauseMenuProps) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <Dialog title="Quit without saving?" label="Quit without saving">
        <p className="wr-dlg__text">This game will be lost — nobody's score is recorded.</p>
        <div className="wr-dlg__row">
          <button type="button" className="btn btn--aqua" onClick={() => { click(); setConfirming(false) }}>Keep playing</button>
          <button type="button" className="btn btn--pink" onClick={() => { sfx.play('burst-whoosh-1'); /* stand-in until Phase 17 adds quit-nosave */ onQuitNoSave() }}>Quit without saving</button>
        </div>
      </Dialog>
    )
  }
  return (
    <div className="wr-dlg wr-dlg--pause" role="dialog" aria-label="Paused">
      <div className="wr-dlg__box">
        <h2 className="wr-dlg__title">Paused</h2>
        <div className="wr-dlg__stack">
          <button type="button" className="btn btn--aqua" onClick={onResume}>Resume</button>
          <button type="button" className="btn" onClick={() => { sfx.play('ui-toggle'); onToggleSound() }}>{muted ? 'Sound: off' : 'Sound: on'}</button>
          <button type="button" className="btn btn--pink" onClick={() => { click(); onSaveQuit() }}>Save &amp; quit to title</button>
          <button type="button" className="btn" onClick={() => { click(); setConfirming(true) }}>Quit without saving</button>
        </div>
      </div>
    </div>
  )
}
