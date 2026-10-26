import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame, type GameState } from './engine/game'
import type { ShortcutStatus } from '../shared/api'
import { sfx, type Voice } from './audio/sfx'
import { Deal } from './screens/Deal'
import { Game } from './screens/Game'
import { GameOver } from './screens/GameOver'
import { FirstDraw } from './screens/FirstDraw'
import { Handoff } from './screens/Handoff'
import { Notebook } from './screens/Notebook'
import { buildGameRecord, newHighScores } from './screens/record'
import { Settings } from './screens/Settings'
import { Setup } from './screens/Setup'
import { ShuffleBag } from './screens/ShuffleBag'
import { Title } from './screens/Title'
import { DEFAULT_SETUP, FACTORY_NAMES, loadDefaultNames, loadSetup, playerNames, type SetupConfig } from './screens/types'
import { resetFinder } from './ai/shared'
import './screens/app.css'

type Screen = 'title' | 'setup' | 'shuffle' | 'draw' | 'deal' | 'handoff' | 'game' | 'over' | 'notebook'

/** The autosave: written at the start of the game and after every turn; Continue reads it back. */
interface SavedGame {
  game: GameState
  setup: SetupConfig
  /** Seconds left on the current turn's timer when saved by Save & quit (timer games). */
  turnSecondsLeft?: number
}

function parseSaved(json: string | null): SavedGame | null {
  if (!json) return null
  try {
    const data = JSON.parse(json) as Partial<SavedGame>
    if (data.game && data.game.phase === 'playing' && data.setup) return { game: data.game, setup: loadSetup(data.setup), turnSecondsLeft: typeof data.turnSecondsLeft === 'number' && data.turnSecondsLeft > 0 ? data.turnSecondsLeft : undefined }
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
  const [voice, setVoice] = useState<Voice>(sfx.getVoice())
  const [defaultNames, setDefaultNames] = useState<string[]>([...FACTORY_NAMES])
  const [confirmAfresh, setConfirmAfresh] = useState(false)
  const [forgetWords, setForgetWords] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  /** Per player: earned the NEW HIGH SCORE stamp. Null while the finished game is still being written down. */
  const [highScores, setHighScores] = useState<boolean[] | null>(null)
  const [notebookBack, setNotebookBack] = useState<Screen>('title')
  /** Autosave save/clear calls run strictly one after another so a late save can never bring a quit game back. */
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const recorded = useRef<GameState | null>(null)
  /** Timer seconds to resume with after Continue; used by the first turn only. */
  const [resumeSeconds, setResumeSeconds] = useState<number | undefined>()
  /** Desktop-shortcut offer: shown once on launch when missing, or when it points at another folder. */
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null)
  const [offerShortcut, setOfferShortcut] = useState(false)

  useEffect(() => {
    void (async () => {
      const [settings, savedJson] = await Promise.all([window.wordRumble.settings.get(), window.wordRumble.savedGame.load()])
      if (typeof settings.volume === 'number') { sfx.setVolume(settings.volume); setVolume(settings.volume) }
      if (settings.voice === 'female' || settings.voice === 'male' || settings.voice === 'off') { sfx.setVoice(settings.voice); setVoice(settings.voice) }
      if (typeof settings.muted === 'boolean') { sfx.setMuted(settings.muted); setMuted(settings.muted) }
      const names = loadDefaultNames(settings.defaultNames)
      setDefaultNames(names)
      if (settings.setup) setSetup(loadSetup(settings.setup, names))
      setSaved(parseSaved(savedJson))
      const status = await window.wordRumble.shortcut.status()
      setShortcut(status)
      if (status.available && ((!status.exists && !status.declined) || status.needsRepair)) setOfferShortcut(true)
    })()
    void sfx.init()
  }, [])

  const flash = useCallback((text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 2600)
  }, [])

  const enqueue = useCallback((job: () => Promise<unknown>) => {
    const run = saveQueue.current.then(job, job)
    saveQueue.current = run.catch(() => undefined)
    return run
  }, [])

  const writeSave = useCallback((json: string) => {
    void enqueue(() => window.wordRumble.savedGame.save(json)).then(() => setSaved(parseSaved(json)))
  }, [enqueue])

  /** Drop the autosave (and the in-memory Continue state) at once. */
  const dropSave = useCallback(() => {
    setSaved(null)
    return enqueue(() => window.wordRumble.savedGame.clear())
  }, [enqueue])

  /** Autosave the game in progress (or drop the autosave once it is over). */
  const autosave = useCallback((current: GameState, config: SetupConfig) => {
    if (current.phase === 'over') { void dropSave(); return }
    writeSave(JSON.stringify({ game: current, setup: config } satisfies SavedGame))
  }, [dropSave, writeSave])

  const openNotebook = (from: Screen) => { setNotebookBack(from); setScreen('notebook') }

  // Game over: read the table, write the game in the notebook once, then reveal the Game over screen.
  useEffect(() => {
    if (screen !== 'over' || !game?.result || recorded.current === game) return
    recorded.current = game
    setHighScores(null)
    void (async () => {
      let stamps = game.players.map(() => false)
      try {
        const top = await window.wordRumble.scores.top(game.options.mode, 10)
        stamps = newHighScores(game, top)
        await window.wordRumble.scores.record(buildGameRecord(game, setup))
      } catch { /* the notebook is a nicety: still show the result */ }
      setHighScores(stamps)
    })()
  }, [screen, game, setup])

  const startGame = (config: SetupConfig) => {
    setResumeSeconds(undefined)
    setSetup(config)
    void window.wordRumble.settings.set('setup', config)
    setGame(createGame({
      mode: config.mode,
      names: playerNames(config, defaultNames),
      timerSeconds: config.timerSeconds,
      hints: config.hints,
      madeUp: config.madeUp,
      shuffle: config.shuffle,
      swap: config.swap
    }))
    setScreen('shuffle')
  }

  const continueGame = () => {
    if (!saved) return
    setSetup(saved.setup)
    setGame(saved.game)
    setResumeSeconds(saved.turnSecondsLeft)
    // Two players: back to the "take the laptop" screen so nobody sees a rack by accident.
    setScreen('handoff')
  }

  /** A turn finished: game over, the next player's "take the laptop" screen (two players), or straight on. */
  const turnDone = useCallback((next: GameState) => {
    setResumeSeconds(undefined)
    setGame(next)
    autosave(next, setup)
    if (next.phase === 'over') { setHighScores(null); setScreen('over'); return }
    setScreen(next.options.mode === 'two' ? 'handoff' : 'game')
  }, [autosave, setup])

  // Save & quit from the pause menu.
  const saveQuit = (current: GameState, secondsLeft: number | null) => {
    writeSave(JSON.stringify({ game: current, setup, turnSecondsLeft: secondsLeft ?? undefined } satisfies SavedGame))
    setResumeSeconds(undefined)
    setScreen('title')
  }

  // Quit without saving: the game is lost, nothing goes in the notebook.
  const quitNoSave = () => {
    void dropSave()
    setGame(null)
    setScreen('title')
  }

  // Start afresh: scores, autosave and default names (and optionally our added words) go.
  const startAfresh = () => {
    const alsoWords = forgetWords
    setConfirmAfresh(false)
    setForgetWords(false)
    setDefaultNames([...FACTORY_NAMES])
    setSetup((old) => ({ ...old, names: [FACTORY_NAMES[0], FACTORY_NAMES[1]] }))
    void (async () => {
      try {
        await dropSave()
        await window.wordRumble.scores.reset()
        await window.wordRumble.settings.delete('defaultNames')
        await window.wordRumble.settings.delete('setup')
        if (alsoWords) { await window.wordRumble.words.clearCustom(); resetFinder() }
        flash('All fresh and new!')
      } catch { flash("Couldn't clear everything.") }
    })()
  }

  const changeDefaultNames = (names: string[]) => {
    const clean = loadDefaultNames(names)
    setDefaultNames(clean)
    void window.wordRumble.settings.set('defaultNames', clean)
  }

  const makeShortcut = () => {
    sfx.play('ui-click')
    setOfferShortcut(false)
    void window.wordRumble.shortcut.create().then((ok) => {
      flash(ok ? 'Desktop shortcut ready!' : "Couldn't make the shortcut.")
      void window.wordRumble.shortcut.status().then(setShortcut)
    })
  }
  const declineShortcut = () => {
    sfx.play('ui-click')
    setOfferShortcut(false)
    if (!shortcut?.needsRepair) void window.wordRumble.shortcut.decline()
  }

  const changeVolume = (v: number) => { setVolume(v); sfx.setVolume(v); void window.wordRumble.settings.set('volume', v) }
  const changeVoice = (v: Voice) => { setVoice(v); sfx.setVoice(v); void window.wordRumble.settings.set('voice', v) }
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
          onScores={() => openNotebook('title')}
          onSettings={() => setShowSettings(true)}
          onQuit={() => void window.wordRumble.quit()}
        />
      )
      break
    case 'setup':
      body = <Setup initial={setup} defaultNames={defaultNames} onStart={startGame} onBack={() => setScreen('title')} />
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
        body = <Deal names={names} colors={colors} counts={game.players.map((p) => p.rack.length)} onDone={() => { if (game) autosave(game, setup); setScreen('handoff') }} />
      }
      break
    case 'handoff':
      if (game) {
        body = <Handoff name={game.players[game.current].name} color={colors[game.current]} onGo={() => setScreen('game')} />
      }
      break
    case 'game':
      if (game) {
        body = (
          <Game
            key={`${game.turn}-${game.current}`}
            game={game}
            colors={colors}
            muted={muted}
            difficulty={setup.difficulty}
            rackSide={setup.rackSide}
            onToggleSound={() => changeMuted(!muted)}
            resumeSeconds={resumeSeconds}
            onTurnDone={turnDone}
            onSaveQuit={saveQuit}
            onQuitNoSave={quitNoSave}
          />
        )
      }
      break
    case 'over':
      if (game?.result && highScores) {
        body = (
          <GameOver
            game={game}
            colors={colors}
            highScores={highScores}
            onNotebook={() => openNotebook('over')}
            onTitle={() => setScreen('title')}
          />
        )
      }
      break
    case 'notebook':
      body = <Notebook onClose={() => setScreen(notebookBack)} />
      break
  }

  return (
    <div className="wr-app">
      {body}
      {showSettings && (
        <Settings
          volume={volume}
          muted={muted}
          voice={voice}
          onVoice={changeVoice}
          onVolume={changeVolume}
          onMuted={changeMuted}
          defaultNames={defaultNames}
          onDefaultNames={changeDefaultNames}
          onResetScores={() => setConfirmReset(true)}
          onStartAfresh={() => { setShowSettings(false); setConfirmAfresh(true) }}
          onShortcut={shortcut?.available ? () => { setShowSettings(false); setOfferShortcut(true) } : undefined}
          onClose={() => setShowSettings(false)}
        />
      )}
      {offerShortcut && (
        <div className="wr-app-confirm" role="alertdialog" aria-label="Desktop shortcut">
          <div className="wr-app-confirm__box">
            <p>{shortcut?.needsRepair ? 'The desktop shortcut points to another copy of the game. Point it here?' : 'Put a Word Rumble shortcut on the desktop?'}</p>
            <div className="wr-app-confirm__row">
              <button className="btn btn--aqua" onClick={declineShortcut}>{shortcut?.needsRepair ? 'Not now' : 'No thanks'}</button>
              <button className="btn btn--pink" onClick={makeShortcut}>{shortcut?.needsRepair ? 'Fix it' : 'Create shortcut'}</button>
            </div>
          </div>
        </div>
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
      {confirmAfresh && (
        <div className="wr-app-confirm" role="alertdialog" aria-label="Start afresh">
          <div className="wr-app-confirm__box">
            <p>Start afresh? This wipes every score, the saved game and the player names.</p>
            <label className="wr-app-confirm__check">
              <input type="checkbox" checked={forgetWords} onChange={(e) => { sfx.play('ui-toggle'); setForgetWords(e.currentTarget.checked) }} />
              Also forget words we added to the word list
            </label>
            <div className="wr-app-confirm__row">
              <button className="btn btn--aqua" onClick={() => { sfx.play('ui-click'); setConfirmAfresh(false); setForgetWords(false) }}>Keep everything</button>
              <button className="btn btn--pink" onClick={() => { sfx.play('ui-click'); startAfresh() }}>Start afresh</button>
            </div>
          </div>
        </div>
      )}
      {notice && <div className="wr-app-notice" role="status">{notice}</div>}
    </div>
  )
}
