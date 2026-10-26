import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createGame, type GameState, type Tile } from '../engine'
import { Game, type Dialog } from './Game'

vi.mock('../audio/sfx', () => ({ sfx: { play: () => undefined } }))

const COLORS = ['#1cc5b4', '#9361e9', '#ff8a2a', '#ff81ba']
const SECRET_SCORES = [111, 4321, 8765, 9753]

/** A fresh four-player game where every rack and score is known, with player 1 on turn. */
function fourPlayers(current: number): GameState {
  const game = createGame({ mode: 'two', names: ['Shane', 'Dawn', 'Mo', 'Jo'], timerSeconds: null, hints: 'off', madeUp: 'no' })
  let id = 1000
  const rack = (letter: string): Tile[] => Array.from({ length: 7 }, () => ({ id: id++, letter, points: 9 }))
  return {
    ...game,
    current,
    players: game.players.map((p, i) => ({ ...p, score: SECRET_SCORES[i], rack: rack('QZXJ'[i]) }))
  }
}

const render = (game: GameState) => renderToStaticMarkup(
  <Game game={game} colors={COLORS} muted={false} difficulty="medium" onToggleSound={() => undefined} onTurnDone={() => undefined} onSaveQuit={() => undefined} onQuitNoSave={() => undefined} />
)

describe('play screen with four players', () => {
  it("shows only the current player's letters and score", () => {
    const markup = render(fourPlayers(1))
    const letters = [...markup.matchAll(/class="wr-tile__letter[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1])
    expect(letters).toEqual(Array(7).fill('Z'))
    expect(markup).toContain('4321')
    for (const i of [0, 2, 3]) expect(markup).not.toContain(String(SECRET_SCORES[i]))
  })

  it('lists the three others as name plates with tile counts only', () => {
    const markup = render(fourPlayers(0))
    const plates = [...markup.matchAll(/class="wr-play__plate[^"]*"[\s\S]*?<strong>([^<]*)<\/strong><span class="wr-play__plate-count">([^<]*)</g)]
    expect(plates.map((m) => [m[1], m[2]])).toEqual([['Dawn', '7 tiles'], ['Mo', '7 tiles'], ['Jo', '7 tiles']])
    // Only one rack is rendered at all: the current player's.
    expect(markup.match(/class="wr-tile wr-tile--rack/g)).toHaveLength(7)
  })

  it('marks a dropped-out player on their plate', () => {
    const game = fourPlayers(0)
    const out = { ...game, players: game.players.map((p, i) => (i === 2 ? { ...p, out: true, rack: [] } : p)) }
    expect(render(out)).toMatch(/<strong>Mo<\/strong><span class="wr-play__plate-count">dropped out</)
  })
})

describe('dialogs where someone else may look', () => {
  const start = (dialog: Dialog) => {
    const game = fourPlayers(1)
    const [a, b] = game.players[1].rack
    const pending = [{ row: 7, col: 7, tile: a, letter: 'Z' }, { row: 7, col: 8, tile: b, letter: 'Z' }]
    return renderToStaticMarkup(
      <Game game={game} colors={COLORS} muted={false} difficulty="medium" onToggleSound={() => undefined} onTurnDone={() => undefined} onSaveQuit={() => undefined} onQuitNoSave={() => undefined} testStart={{ pending, dialog }} />
    )
  }
  const action = { type: 'play' as const, placements: [] }
  const dialogs: [string, Dialog][] = [
    ['recipient picker', { kind: 'recipient', action }],
    ['voter cover', { kind: 'vote', action, word: 'zzz', voters: [0, 2, 3], votes: [] }],
    ['drop-out picker', { kind: 'defeat' }]
  ]

  it.each(dialogs)('%s: no rack letters, scores, pending tiles, preview or Play points in the markup', (_name, dialog) => {
    const markup = start(dialog)
    expect(markup).not.toMatch(/wr-tile__letter/)
    expect(markup).not.toMatch(/wr-tile--pending/)
    for (const score of SECRET_SCORES) expect(markup).not.toContain(String(score))
    expect(markup).not.toMatch(/\d+ points/)
    expect(markup).not.toMatch(/Play \(/)
  })

  it('control: with no dialog the same state does show the pending tile and the Play points', () => {
    const markup = start(null)
    expect(markup).toMatch(/wr-tile--pending/)
    expect(markup).toMatch(/Play \(/)
  })

  it('the recipient picker lists the other players without scores', () => {
    const markup = start({ kind: 'recipient', action })
    for (const name of ['Shane', 'Mo', 'Jo']) expect(markup).toContain(name)
  })
})
