import { useEffect, useState, type CSSProperties } from 'react'
import { Tile } from '../components'
import type { FirstDrawStep } from '../engine/game'
import { sfx } from '../audio/sfx'
import './screens.css'

export interface FirstDrawProps {
  rounds: FirstDrawStep[][]
  names: string[]
  colors: string[]
  starter: number
  onDone(): void
}

export function FirstDraw({ rounds, names, colors, starter, onDone }: FirstDrawProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [winnerShown, setWinnerShown] = useState(false)
  const round = rounds[roundIndex] ?? []
  const hasNext = roundIndex < rounds.length - 1

  useEffect(() => {
    if (round.length === 0) { setWinnerShown(true); return }
    if (revealed < round.length) {
      const timer = setTimeout(() => { sfx.play('first-draw-reveal'); setRevealed((n) => n + 1) }, revealed === 0 ? 420 : 760)
      return () => clearTimeout(timer)
    }
    if (hasNext) {
      const timer = setTimeout(() => { setRoundIndex((n) => n + 1); setRevealed(0) }, 1500)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setWinnerShown(true), 600)
    return () => clearTimeout(timer)
  }, [round.length, revealed, hasNext, roundIndex])

  return (
    <main className="wr-screen wr-first-draw halftone-3">
      <div className="wr-first-draw__panel">
        <p className="wr-eyebrow">Who takes the first turn?</p>
        <h1 className="wr-screen-title">First Draw!</h1>
        <p className="wr-first-draw__rule">Closest to A starts. A blank beats every letter!</p>
        <div className={`wr-first-draw__cards wr-first-draw__cards--${round.length}`} key={roundIndex}>
          {round.map(({ player, tile }, index) => (
            <div className={`wr-first-draw__card ${winnerShown && player === starter ? 'wr-first-draw__card--winner' : ''}`} key={player} style={{ '--wr-player': colors[player] ?? 'var(--teal)' } as CSSProperties}>
              <span className="wr-first-draw__name">{names[player] ?? `Player ${player + 1}`}</span>
              <div className={`wr-first-draw__tile ${index < revealed ? 'wr-first-draw__tile--shown' : ''}`}>
                {index < revealed ? <><Tile tile={tile} state="board" />{tile.letter === '?' ? <span className="wr-first-draw__blank">blank</span> : null}</> : <span className="wr-first-draw__question" aria-label="Tile not revealed yet">?</span>}
              </div>
            </div>
          ))}
        </div>
        {hasNext && revealed === round.length && round.length > 0 ? <p className="wr-first-draw__banner wr-first-draw__banner--tie" role="status">Tie! Draw again</p> : null}
        {winnerShown ? <><p className="wr-first-draw__banner" role="status">{names[starter] ?? `Player ${starter + 1}`} goes first!</p><button className="btn btn--pink wr-first-draw__next" type="button" onMouseEnter={() => sfx.play('ui-hover')} onClick={() => { sfx.play('ui-click'); onDone() }}>Deal the tiles</button></> : null}
      </div>
    </main>
  )
}
