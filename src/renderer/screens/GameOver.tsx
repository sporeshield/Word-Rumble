import { useEffect, useState, type CSSProperties } from 'react'
import trophy from '@art/trophy.webp'
import crown from '@art/notebook-doodles/crown.webp'
import type { GameState } from '../engine/game'
import { sfx } from '../audio/sfx'
import { placeNumbers } from './record'
import { ComicBurst, Confetti } from '../fx'
import './screens.css'
import './gameover.css'

export interface GameOverProps {
  game: GameState
  colors: string[]
  highScores: boolean[]
  onNotebook(): void
  onTitle(): void
}

export function GameOver({ game, colors, highScores, onNotebook, onTitle }: GameOverProps) {
  const result = game.result
  const [displayScores, setDisplayScores] = useState<number[]>(() => game.players.map(() => 0))
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    if (!result) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    let frame = 0
    let start = 0
    if (result.reason === 'conceded') {
      sfx.play('defeat-trombone')
      timers.push(window.setTimeout(() => sfx.play('game-over-fanfare'), 550))
    } else sfx.play('game-over-fanfare')

    if (reduced) setDisplayScores(result.finalScores)
    else {
      const animate = (time: number) => {
        if (!start) start = time
        const elapsed = time - start
        setDisplayScores(result.finalScores.map((score, index) => {
          const progress = Math.min(1, Math.max(0, (elapsed - index * 170) / 1200))
          return Math.round(score * (1 - (1 - progress) ** 3))
        }))
        if (elapsed < 1200 + (result.finalScores.length - 1) * 170) frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    }
    if (result.winner !== null) timers.push(window.setTimeout(() => setBurst(true), reduced ? 0 : 390))
    highScores.forEach((high, index) => {
      if (high) timers.push(window.setTimeout(() => sfx.play('high-score-ding'), reduced ? 0 : 840 + index * 170))
    })
    return () => { window.cancelAnimationFrame(frame); timers.forEach(window.clearTimeout) }
  }, [result, highScores])

  if (!result) return null
  const solo = game.players.length === 1
  const many = game.players.length > 2
  const title = result.reason === 'out' ? 'Out of tiles!'
    : result.reason === 'scoreless' ? 'Nobody can move!'
      : result.reason === 'finished' ? 'Run finished'
        : many ? 'Last player standing!' : `${game.players[result.conceder ?? 0]?.name ?? 'Someone'} admits defeat`
  const places = placeNumbers(result.ranking, game.players.length)
  const order = result.ranking.flat()
  const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
  const dropLine = (index: number): string | null => {
    const player = game.players[index]
    if (!many || !player.out || !player.conceded) return null
    const to = game.history.find((t) => t.kind === 'dropped' && t.player === index)?.giftTo
    const toName = to === undefined ? undefined : game.players[to]?.name
    return toName && (player.givenAway ?? 0) > 0 ? `dropped out — gave ${player.givenAway} to ${toName}` : 'dropped out'
  }
  const outcome = solo ? 'Final score' : result.winner === null ? (result.ranking[0].length === game.players.length ? "It's a draw!" : `${result.ranking[0].map((i) => game.players[i].name).join(' & ')} share first place!`) : `${game.players[result.winner].name} wins!`

  return (
    <main className="wr-screen wr-gameover halftone-1">
      {result.winner !== null || (!solo && result.ranking[0].length < game.players.length) ? <Confetti pieces={90} /> : null}
      {burst && result.winner !== null ? <ComicBurst text="WINNER!" tier="top" onDone={() => setBurst(false)} /> : null}
      <section className="wr-gameover__layout" aria-labelledby="wr-gameover-title">
        <header className="wr-gameover__header">
          <p className="wr-eyebrow">The final reveal</p>
          <h1 id="wr-gameover-title" className="wr-screen-title">{title}</h1>
          <p className="wr-gameover__outcome">{outcome}</p>
        </header>
        <div className={`wr-gameover__cards ${solo ? 'wr-gameover__cards--solo' : ''} wr-gameover__cards--n${game.players.length}`}>
          {order.map((index) => {
            const player = game.players[index]
            const winner = result.winner === index
            const drop = dropLine(index)
            const adjustments = result.adjustments.filter((adjustment) => adjustment.player === index)
            return (
              <article key={index} className={`wr-gameover__card ${winner ? 'wr-gameover__card--winner' : ''}`} style={{ '--card-color': colors[index] ?? (index ? 'var(--violet)' : 'var(--teal)'), '--card-delay': `${index * 170}ms` } as CSSProperties}>
                {winner ? <><img className="wr-gameover__crown" src={crown} alt="" /><img className="wr-gameover__trophy" src={trophy} alt="" /></> : null}
                {highScores[index] ? <span className="wr-gameover__stamp">NEW HIGH SCORE!</span> : null}
                {many ? <span className={`wr-gameover__place wr-gameover__place--${places[index]}`}>{ordinal(places[index])}</span> : null}
                <div className="wr-gameover__card-head">
                  <h2>{game.options.mode === 'computer' && index === 1 ? 'Computer' : player.name}</h2>
                  {!many && result.conceder === index && result.reason === 'conceded' ? <span className="wr-gameover__conceded">conceded</span> : null}
                </div>
                {drop ? <p className="wr-gameover__dropped">{drop}</p> : null}
                <div className="wr-gameover__score" aria-label={`Final score ${result.finalScores[index]}`}>
                  <strong aria-hidden="true">{displayScores[index] ?? result.finalScores[index]}</strong><span>points</span>
                </div>
                <div className="wr-gameover__ledger">
                  <div><span>Before adjustments</span><b>{result.preAdjust[index]}</b></div>
                  {adjustments.map((adjustment, adjustmentIndex) => <div key={adjustmentIndex}><span>{adjustment.label}</span><b>{adjustment.delta > 0 ? '+' : ''}{adjustment.delta}</b></div>)}
                </div>
                <div className="wr-gameover__stats" aria-label={`${player.name} game stats`}>
                  <span><b>{player.rumbles}</b> Rumbles</span><span><b>{player.madeUpCount}</b> Made-up words</span><span><b>{player.hintsUsed}</b> Hints</span>
                </div>
              </article>
            )
          })}
        </div>
        <footer className="wr-gameover__actions">
          <button type="button" className="btn btn--pink" onClick={() => { sfx.play('ui-click'); onNotebook() }}>Write it in the notebook</button>
          <button type="button" className="btn btn--aqua" onClick={() => { sfx.play('ui-click'); onTitle() }}>Back to title</button>
        </footer>
      </section>
    </main>
  )
}
