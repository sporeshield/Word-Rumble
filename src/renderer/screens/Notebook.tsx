import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import paper from '@art/notebook-paper.webp'
import spiral from '@art/notebook-spiral.webp'
import crown from '@art/notebook-doodles/crown.webp'
import star from '@art/notebook-doodles/star.webp'
import stickTrophy from '@art/notebook-doodles/stick-trophy.webp'
import type { Row, ScoreFilter } from '../../shared/api'
import { sfx } from '../audio/sfx'
import { formatNotebookDate, penaltyLabel, recentHeadline, recentPlayers, tallyGroups } from './notebook-format'
import './screens.css'
import './notebook.css'

export interface NotebookProps { onClose(): void }

type Tab = 'top' | 'head' | 'plays' | 'recent' | 'shame'
type Shame = { madeUpWords: Row[]; penalties: Row[]; perPlayer: Row[] }
type Data = Row[] | Shame
const tabs: { id: Tab; label: string }[] = [
  { id: 'top', label: 'Top Scores' }, { id: 'head', label: 'Head to Head' },
  { id: 'plays', label: 'Best Plays' }, { id: 'recent', label: 'Recent Games' },
  { id: 'shame', label: 'Hall of Shame' }
]
const filters: { id: ScoreFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'two', label: 'Friends' },
  { id: 'solo', label: 'Solo' }, { id: 'computer', label: 'vs Computer' }
]
const num = (value: unknown): number => Number(value) || 0
const name = (value: unknown): string => typeof value === 'string' ? value : 'Unknown player'
const words = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((word): word is string => typeof word === 'string')
  if (typeof value === 'string') {
    try { return words(JSON.parse(value)) } catch { return [] }
  }
  return []
}
const modeLabel = (mode: unknown, difficulty?: unknown): string => {
  const label = mode === 'solo' ? 'Solo' : mode === 'computer' ? 'vs Computer' : 'Friends'
  return difficulty ? `${label} · ${String(difficulty)}` : label
}
const reasonLabel = (reason: unknown): string => ({ out: 'Out of tiles', scoreless: 'Nobody could move', conceded: 'Conceded', finished: 'Run finished' })[String(reason) as 'out' | 'scoreless' | 'conceded' | 'finished'] ?? 'Game over'
const asRows = (data: Data | null): Row[] => Array.isArray(data) ? data : []
const isShame = (data: Data | null): data is Shame => !!data && !Array.isArray(data)

function Tally({ count, label = 'wins' }: { count: number | null; label?: string }) {
  const groups = tallyGroups(count)
  return <span className="wr-notebook__tallies" aria-label={`${num(count)} ${label}`}>
    {groups.length ? groups.map((strokes, index) => <svg key={index} viewBox="0 0 34 30" width="34" height="30" aria-hidden="true">
      {[0, 1, 2, 3].slice(0, strokes).map((line) => <path key={line} d={`M${5 + line * 7} 3 L${3 + line * 7} 27`} />)}
      {strokes === 5 ? <path d="M1 23 L32 5" /> : null}
    </svg>) : <span className="wr-notebook__tally-zero">—</span>}
  </span>
}

export function Notebook({ onClose }: NotebookProps) {
  const [tab, setTab] = useState<Tab>('top')
  const [filter, setFilter] = useState<ScoreFilter>('all')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const heard = useRef(new Set<string>())
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    setData(null)
    const request = tab === 'top' ? window.wordRumble.scores.top(filter, 10)
      : tab === 'head' ? window.wordRumble.scores.headToHead()
        : tab === 'plays' ? window.wordRumble.scores.bestPlays(10)
          : tab === 'recent' ? window.wordRumble.scores.recent(15)
            : window.wordRumble.scores.hallOfShame()
    void request.then((rows) => {
      if (!active) return
      setData(rows)
      setLoading(false)
      const hasEntries = Array.isArray(rows) ? rows.length > 0 : rows.madeUpWords.length + rows.penalties.length + rows.perPlayer.length > 0
      const key = `${tab}:${tab === 'top' ? filter : ''}`
      if (hasEntries && !heard.current.has(key)) { heard.current.add(key); sfx.play('pencil-scribble') }
    }).catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false }
  }, [tab, filter, retry])

  const chooseTab = (next: Tab) => {
    sfx.play('ui-click')
    if (next !== tab) { sfx.play('page-flip'); setTab(next) }
  }
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    tabRefs.current[next]?.focus()
    chooseTab(tabs[next].id)
  }

  const rows = asRows(data)
  const empty = <div className="wr-notebook__empty"><img src={stickTrophy} alt="" /><p>Nothing written yet - go play!</p></div>
  let content
  if (loading) content = <p className="wr-notebook__message" role="status">Opening the notebook...</p>
  else if (error) content = <div className="wr-notebook__message" role="alert"><p>Couldn't open this page. Give it another try!</p><button className="btn btn--aqua" type="button" onClick={() => { sfx.play('ui-click'); setRetry((n) => n + 1) }}>Try again</button></div>
  else if (tab === 'top') content = rows.length ? <ol className="wr-notebook__list wr-notebook__scores">
    {rows.map((row, index) => <li key={index} className="wr-notebook__row">
      <span className="wr-notebook__rank">#{index + 1}</span>{index === 0 ? <img className="wr-notebook__rank-crown" src={crown} alt="" /> : null}
      <span className="wr-notebook__row-main"><strong>{name(row.name)}</strong><small>{modeLabel(row.mode, row.difficulty)} · {formatNotebookDate(row.playedAt)}{num(row.conceded) ? <em> · conceded</em> : null}</small></span>
      <b className="wr-notebook__points">{num(row.score)}</b>
    </li>)}
  </ol> : empty
  else if (tab === 'head') content = rows.length ? <div className="wr-notebook__pairs">{rows.map((row, index) => <article key={index} className="wr-notebook__pair">
    <div className="wr-notebook__pair-title"><strong>{name(row.a)} <span>vs</span> {name(row.b)}</strong><small>{num(row.games)} games</small></div>
    <div className="wr-notebook__pair-sides"><div><b>{name(row.a)}</b><Tally count={num(row.aWins)} /><span>{num(row.aWins)} wins · avg {Math.round(num(row.aAvg))} · {num(row.aConceded)} conceded</span></div>
      <div><b>{name(row.b)}</b><Tally count={num(row.bWins)} /><span>{num(row.bWins)} wins · avg {Math.round(num(row.bAvg))} · {num(row.bConceded)} conceded</span></div></div>
    <p className="wr-notebook__draws">Draws: <b>{num(row.draws)}</b></p>
  </article>)}</div> : empty
  else if (tab === 'plays') content = rows.length ? <ol className="wr-notebook__list">{rows.map((row, index) => <li key={index} className="wr-notebook__row">
    <span className="wr-notebook__rank">#{index + 1}</span><span className="wr-notebook__row-main"><strong>{words(row.words).join(' + ').toUpperCase() || 'WORD PLAY'}</strong><small>{name(row.name)} · {formatNotebookDate(row.playedAt)}</small></span>
    {num(row.rumble) ? <span className="wr-notebook__rumble"><img src={star} alt="" /> RUMBLE!</span> : null}<b className="wr-notebook__points">{num(row.score)}</b>
  </li>)}</ol> : empty
  else if (tab === 'recent') content = rows.length ? <ol className="wr-notebook__list">{rows.map((row, index) => {
    const players = recentPlayers(row.players)
    return <li key={String(row.id ?? index)} className="wr-notebook__row wr-notebook__row--recent"><span className="wr-notebook__row-main">
      <strong>{recentHeadline(players)}</strong>
      <small>{modeLabel(row.mode, row.difficulty)} · {reasonLabel(row.endedReason)} · {formatNotebookDate(row.playedAt)}</small>
      <span className="wr-notebook__recent-players">{players.map((player, playerIndex) => <span key={playerIndex}>{player.name} <b>{player.score}</b></span>)}</span>
    </span></li>
  })}</ol> : empty
  else {
    const shame = isShame(data) ? data : { madeUpWords: [], penalties: [], perPlayer: [] }
    content = shame.madeUpWords.length + shame.penalties.length + shame.perPlayer.length ? <div className="wr-notebook__shame">
      <section><h2>Repeat offenders</h2>{shame.perPlayer.length ? <div className="wr-notebook__shame-grid">{shame.perPlayer.map((row, index) => <article key={index} className="wr-notebook__shame-card"><strong>{name(row.name)}</strong><span>{num(row.madeUp)} made-up words</span><span>{num(row.hints)} hints bought · {num(row.hintPointsLost)} points lost</span><span>{num(row.shufflePointsLost)} points lost to shuffles · {num(row.swapPointsLost)} to swaps</span><span>{num(row.defeats)} defeats admitted</span></article>)}</div> : <p>No repeat offenders yet.</p>}</section>
      <section><h2>Penalty wheel</h2>{shame.penalties.length ? <div className="wr-notebook__penalties">{shame.penalties.map((row, index) => <div key={index}><span>{penaltyLabel(row.penalty)}</span><Tally count={num(row.n)} label="spins" /><b>{num(row.n)}</b></div>)}</div> : <p>No penalties spun yet.</p>}</section>
      <section><h2>Made-up words</h2>{shame.madeUpWords.length ? <ol className="wr-notebook__list">{shame.madeUpWords.map((row, index) => <li key={index} className="wr-notebook__row"><span className="wr-notebook__row-main"><strong>{words(row.words).join(' + ').toUpperCase() || 'MYSTERY WORD'}</strong><small>{name(row.name)} · {formatNotebookDate(row.playedAt)} · {penaltyLabel(row.penalty)}</small></span><b className="wr-notebook__points">{num(row.score)}</b></li>)}</ol> : <p>No made-up words yet.</p>}</section>
    </div> : empty
  }

  return <main className="wr-screen wr-notebook halftone-2">
    <section className="wr-notebook__book" aria-label="Word Rumble notebook">
      <img className="wr-notebook__spiral" src={spiral} alt="" />
      <div className="wr-notebook__paper" style={{ backgroundImage: `url(${paper})` }}>
        <header className="wr-notebook__header"><div><p className="wr-eyebrow">Word Rumble records</p><h1 className="wr-screen-title">The Notebook</h1></div><img src={stickTrophy} alt="" /><button type="button" className="btn btn--pink" onClick={() => { sfx.play('ui-click'); onClose() }}>Back</button></header>
        <nav className="wr-notebook__tabs" role="tablist" aria-label="Notebook pages">{tabs.map((item, index) => <button key={item.id} ref={(element) => { tabRefs.current[index] = element }} id={`wr-notebook-tab-${item.id}`} type="button" role="tab" tabIndex={tab === item.id ? 0 : -1} aria-selected={tab === item.id} aria-controls="wr-notebook-panel" className={tab === item.id ? 'wr-notebook__tab wr-notebook__tab--active' : 'wr-notebook__tab'} onClick={() => chooseTab(item.id)} onKeyDown={(event) => onTabKeyDown(event, index)}>{item.label}</button>)}</nav>
        {tab === 'top' ? <div className="wr-notebook__filters" aria-label="Score mode">{filters.map((item) => <button key={item.id} type="button" className={filter === item.id ? 'wr-notebook__filter wr-notebook__filter--active' : 'wr-notebook__filter'} aria-pressed={filter === item.id} onClick={() => { sfx.play('ui-click'); if (filter !== item.id) { sfx.play('page-flip'); setFilter(item.id) } }}>{item.label}</button>)}</div> : null}
        <div id="wr-notebook-panel" role="tabpanel" aria-labelledby={`wr-notebook-tab-${tab}`} className="wr-notebook__content" tabIndex={0}>{content}</div>
      </div>
    </section>
  </main>
}
