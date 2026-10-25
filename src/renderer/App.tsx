import { useCallback, useEffect, useState } from 'react'
import { Board, Rack } from './components'
import { createGame, type GameState } from './engine/game'
import { sfx } from './audio/sfx'
import { Deal } from './screens/Deal'
import { FirstDraw } from './screens/FirstDraw'
import { Handoff } from './screens/Handoff'
import { Settings } from './screens/Settings'
import { Setup } from './screens/Setup'
import { ShuffleBag } from './screens/ShuffleBag'
import { Title } from './screens/Title'
import { DEFAULT_SETUP, loadSetup, playerNames, type SetupConfig } from './screens/types'
import './screens/app.css'

type Screen = 'title' | 'setup' | 'shuffle' | 'draw' | 'deal' | 'handoff' | 'game'

/** Shape the Phase 12 autosave will use; Continue accepts it as-is. */
interface SavedGame {
  game: GameState
  setup: SetupConfig
}

function parseSaved(json: string | null): SavedGame | null {
  if (!json) return null
  try {
    const data = JSON.parse(json) as Partial<SavedGame>
    if (data.game && data.game.phase === 'playing' && data.setup) return { game: data.game, setup: loadSetup(data.setup) }
  } catch { /* corrupt autosave: treat as none */ }
  return null
}

export function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [setup, setSetup] = useState<SetupConfig>(DEFAULT_SETUP)
  const [game, setGame] = useState<GameState | null>(null)
  const [saved, setSaved] = useState<SavedGame | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [volume, setVolume] = useState(sfx.getVolume())
  const [muted, setMuted] = useState(sfx.isMuted())
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [settings, savedJson] = await Promise.all([window.wordRumble.settings.get(), window.wordRumble.savedGame.load()])
      if (typeof settings.volume === 'number') { sfx.setVolume(settings.volume); setVolume(settings.volume) }
      if (typeof settings.muted === 'boolean') { sfx.setMuted(settings.muted); setMuted(settings.muted) }
      if (settings.setup) setSetup(loadSetup(settings.setup))
      setSaved(parseSaved(savedJson))
    })()
    void sfx.init()
  }, [])

  const flash = useCallback((text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 2600)
  }, [])

  const startGame = (config: SetupConfig) => {
    setSetup(config)
    void window.wordRumble.settings.set('setup', config)
    setGame(createGame({
      mode: config.mode,
      names: playerNames(config),
      timerSeconds: config.timerSeconds,
      hints: config.hints,
      madeUp: config.madeUp
    }))
    setScreen('shuffle')
  }

  const continueGame = () => {
    if (!saved) return
    setSetup(saved.setup)
    setGame(saved.game)
    // Two players: back to the "take the laptop" screen so nobody sees a rack by accident.
    setScreen('handoff')
  }

  const changeVolume = (v: number) => { setVolume(v); sfx.setVolume(v); void window.wordRumble.settings.set('volume', v) }
  const changeMuted = (m: boolean) => { setMuted(m); sfx.setMuted(m); void window.wordRumble.settings.set('muted', m) }

  const names = game?.players.map((p) => p.name) ?? []
  const colors = [setup.colors[0], setup.mode === 'computer' ? '#ff8a2a' : setup.colors[1]]

  let body = null
  switch (screen) {
    case 'title':
      body = (
        <Title
          canContinue={saved !== null}
          onNewGame={() => setScreen('setup')}
          onContinue={continueGame}
          onScores={() => flash('The high-score notebook arrives in a later phase.')}
          onSettings={() => setShowSettings(true)}
          onQuit={() => void window.wordRumble.quit()}
        />
      )
      break
    case 'setup':
      body = <Setup initial={setup} onStart={startGame} onBack={() => setScreen('title')} />
      break
    case 'shuffle':
      body = (
        <ShuffleBag
          onShaken={() => setScreen(game && game.players.length > 1 ? 'draw' : 'deal')}
        />
      )
      break
    case 'draw':
      if (game) {
        body = (
          <FirstDraw
            rounds={game.firstDraw}
            names={names}
            colors={colors}
            starter={game.current}
            onDone={() => setScreen('deal')}
          />
        )
      }
      break
    case 'deal':
      if (game) {
        // Counts only: the letters never reach the deal screen.
        body = <Deal names={names} colors={colors} counts={game.players.map((p) => p.rack.length)} onDone={() => setScreen('handoff')} />
      }
      break
    case 'handoff':
      if (game) {
        body = <Handoff name={game.players[game.current].name} color={colors[game.current]} onGo={() => setScreen('game')} />
      }
      break
    case 'game':
      if (game) {
        // Placeholder until Phase 10 builds the real play loop.
        const me = game.players[game.current]
        const humanTurn = !(game.options.mode === 'computer' && game.current === 1)
        body = (
          <div className="wr-app-game halftone-2">
            <Board board={game.board} pending={[]} />
            <Rack owner={me.name} color={colors[game.current]} tiles={me.rack} count={me.rack.length} faceDown={!humanTurn} />
            <button className="btn btn--pink" onClick={() => { sfx.play('ui-click'); setScreen('title') }}>Back to title</button>
          </div>
        )
      }
      break
  }

  return (
    <div className="wr-app">
      {body}
      {showSettings && (
        <Settings
          volume={volume}
          muted={muted}
          onVolume={changeVolume}
          onMuted={changeMuted}
          onResetScores={() => setConfirmReset(true)}
          onClose={() => setShowSettings(false)}
        />
      )}
      {confirmReset && (
        <div className="wr-app-confirm" role="alertdialog" aria-label="Reset scores">
          <div className="wr-app-confirm__box">
            <p>Wipe every saved score and the whole notebook?</p>
            <div className="wr-app-confirm__row">
              <button className="btn btn--aqua" onClick={() => { sfx.play('ui-click'); setConfirmReset(false) }}>Keep them</button>
              <button
                className="btn btn--pink"
                onClick={() => {
                  sfx.play('ui-click')
                  void window.wordRumble.scores.reset().then(() => flash('Scores cleared.'))
                  setConfirmReset(false)
                }}
              >
                Reset scores
              </button>
            </div>
          </div>
        </div>
      )}
      {notice && <div className="wr-app-notice" role="status">{notice}</div>}
    </div>
  )
}
