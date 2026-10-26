import { useState, type CSSProperties } from 'react'
import { sfx } from '../audio/sfx'
import { COLOR_CHOICES, FACTORY_NAMES, computerColor, TIMER_PRESETS, clampTimer, seatCount, swapColor, type PlayerCount, type SetupConfig } from './types'
import './screens.css'

export interface SetupProps {
  initial: SetupConfig
  /** Names from Settings → Players; used as placeholders and when a name is left blank. */
  defaultNames?: readonly string[]
  onStart(config: SetupConfig): void
  onBack(): void
}

const PLAYER_COUNTS: readonly PlayerCount[] = [2, 3, 4]
const timerLabel =(seconds: number) => seconds < 60 ? `${seconds}s` : `${seconds / 60} min`
const hover = () => sfx.play('ui-hover')
const chooseSound = () => { sfx.play('ui-click'); sfx.play('ui-toggle') }

export function Setup({ initial, defaultNames = FACTORY_NAMES, onStart, onBack }: SetupProps) {
  const [config, setConfig] = useState<SetupConfig>(() => ({ ...initial, names: [...initial.names], colors: [...initial.colors] }))
  const [customDraft, setCustomDraft] = useState(() => String(initial.timerSeconds && !TIMER_PRESETS.includes(initial.timerSeconds as typeof TIMER_PRESETS[number]) ? initial.timerSeconds : 90))
  const customTimer = config.timerSeconds !== null && !TIMER_PRESETS.includes(config.timerSeconds as typeof TIMER_PRESETS[number])

  const seats = seatCount(config)

  const setMode = (mode: SetupConfig['mode']) => { chooseSound(); setConfig((old) => ({ ...old, mode })) }
  const setPlayers = (players: PlayerCount) => {
    if (players > config.players) sfx.play('player-joins')
    else chooseSound()
    setConfig((old) => ({ ...old, players }))
  }
  const setName = (index: number, name: string) => setConfig((old) => {
    const names = [...old.names]
    names[index] = name
    return { ...old, names }
  })
  const setColor = (index: number, color: string) => {
    chooseSound()
    setConfig((old) => ({ ...old, colors: swapColor(old.colors, index, color) }))
  }
  const setTimer = (seconds: number | null) => { chooseSound(); setConfig((old) => ({ ...old, timerSeconds: seconds })) }
  const commitCustom = () => {
    const seconds = clampTimer(Number(customDraft)) ?? 90
    setCustomDraft(String(seconds))
    if (customTimer) setConfig((old) => ({ ...old, timerSeconds: seconds }))
  }
  const start = () => {
    sfx.play('ui-click')
    const names = config.names.map((name, i) => name.trim() || defaultNames[i] || `Player ${i + 1}`)
    onStart({ ...config, names, timerSeconds: customTimer ? (clampTimer(Number(customDraft)) ?? 90) : config.timerSeconds })
  }

  const player = (index: number) => {
    const computer = config.mode === 'computer' && index === 1
    return (
      <div className="wr-setup__player" key={index} style={{ '--wr-accent': computer ? computerColor(config.colors[0]) : config.colors[index] } as CSSProperties}>
        <div className="wr-setup__player-head"><span className="wr-setup__number">{index + 1}</span><strong>{computer ? 'Computer' : `Player ${index + 1}`}</strong></div>
        {computer ? <div className="wr-setup__computer">Computer opponent</div> : (
          <label className="wr-field">Name
            <input type="text" value={config.names[index]} maxLength={16} placeholder={defaultNames[index]} onMouseEnter={hover} onClick={() => sfx.play('ui-click')} onChange={(event) => setName(index, event.currentTarget.value)} />
          </label>
        )}
        {/* The computer's colour is fixed (orange, or pink if the human took orange). */}
        {computer ? null : (
          <div className="wr-setup__swatches" role="group" aria-label={`Player ${index + 1} colour`}>
            {COLOR_CHOICES.map((color) => (
              <button key={color} className={`wr-setup__swatch ${config.colors[index] === color ? 'wr-setup__swatch--active' : ''}`} style={{ backgroundColor: color }} type="button" aria-label={`${color} colour`} aria-pressed={config.colors[index] === color} onMouseEnter={hover} onClick={() => setColor(index, color)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="wr-screen wr-setup halftone-2">
      <section className="wr-panel wr-setup__panel" aria-labelledby="wr-setup-title">
        <header className="wr-setup__header"><div><p className="wr-eyebrow">Ready, set, rumble</p><h1 id="wr-setup-title" className="wr-screen-title">New Game</h1></div><span className="wr-setup__star" aria-hidden="true">✦</span></header>
        <div className="wr-setup__mode" role="group" aria-label="Game mode">
          {([['solo', 'Solo run'], ['two', 'Friends'], ['computer', 'vs Computer']] as const).map(([value, label]) => (
            <button key={value} type="button" className={`wr-choice ${config.mode === value ? 'wr-choice--active' : ''}`} aria-pressed={config.mode === value} onMouseEnter={hover} onClick={() => setMode(value)}>{label}</button>
          ))}
        </div>
        <div className="wr-setup__grid">
          <div className={`wr-setup__players wr-setup__players--${seats}`}>
            {config.mode === 'two' ? (
              <div className="wr-setup__count" role="group" aria-label="How many players">
                <span className="wr-setup__label">How many players?</span>
                <div className="wr-setup__count-buttons">
                  {PLAYER_COUNTS.map((n) => <button key={n} type="button" className={`wr-choice wr-setup__count-button ${config.players === n ? 'wr-choice--active' : ''}`} aria-pressed={config.players === n} onMouseEnter={hover} onClick={() => setPlayers(n)}>{n}</button>)}
                </div>
              </div>
            ) : null}
            {Array.from({ length: seats }, (_, index) => player(index))}
            {config.mode === 'computer' ? <div className="wr-setup__difficulty"><span className="wr-setup__label">Computer difficulty</span><div className="wr-setup__difficulty-buttons" role="group" aria-label="Computer difficulty">{(['easy', 'medium', 'hard'] as const).map((difficulty) => <button key={difficulty} type="button" className={`wr-choice ${config.difficulty === difficulty ? 'wr-choice--active' : ''}`} aria-pressed={config.difficulty === difficulty} onMouseEnter={hover} onClick={() => { chooseSound(); setConfig((old) => ({ ...old, difficulty })) }}>{difficulty}</button>)}</div></div> : null}
          </div>
          <div className="wr-setup__rules">
            <section className="wr-setup__rule"><h2>Turn timer</h2><div className="wr-setup__options" role="group" aria-label="Turn timer">
              <button className={`wr-choice ${config.timerSeconds === null ? 'wr-choice--active' : ''}`} type="button" aria-pressed={config.timerSeconds === null} onMouseEnter={hover} onClick={() => setTimer(null)}>Off</button>
              {TIMER_PRESETS.map((seconds) => <button key={seconds} className={`wr-choice ${config.timerSeconds === seconds ? 'wr-choice--active' : ''}`} type="button" aria-pressed={config.timerSeconds === seconds} onMouseEnter={hover} onClick={() => setTimer(seconds)}>{timerLabel(seconds)}</button>)}
              <button className={`wr-choice ${customTimer ? 'wr-choice--active' : ''}`} type="button" aria-pressed={customTimer} onMouseEnter={hover} onClick={() => setTimer(clampTimer(Number(customDraft)) ?? 90)}>Custom</button>
              {customTimer ? <label className="wr-setup__custom">Seconds <input type="number" min="15" max="600" value={customDraft} onMouseEnter={hover} onClick={() => sfx.play('ui-click')} onChange={(event) => { const value = event.currentTarget.value; setCustomDraft(value); const parsed = Number(value); if (value && parsed >= 15 && parsed <= 600) setConfig((old) => ({ ...old, timerSeconds: parsed })) }} onBlur={commitCustom} /></label> : null}
            </div></section>
            <section className="wr-setup__rule"><h2>Hints</h2><div className="wr-setup__options" role="group" aria-label="Hints">{([['off', 'Off'], ['free', 'Free'], ['penalty', 'Costs 1–10']] as const).map(([value, label]) => <button key={value} className={`wr-choice ${config.hints === value ? 'wr-choice--active' : ''}`} type="button" aria-pressed={config.hints === value} onMouseEnter={hover} onClick={() => { chooseSound(); setConfig((old) => ({ ...old, hints: value })) }}>{label}</button>)}</div><p>Hints can help you spot a move; a costly hint takes 1–10 points, quoted first.</p></section>
            {(['shuffle', 'swap'] as const).map((key) => (
              <section key={key} className="wr-setup__rule"><h2>{key === 'shuffle' ? 'Shuffle' : 'Swap'}</h2><div className="wr-setup__options" role="group" aria-label={key === 'shuffle' ? 'Shuffle' : 'Swap'}>{([['free', 'Free'], ['penalty', 'Costs 1–10']] as const).map(([value, label]) => <button key={value} className={`wr-choice ${config[key] === value ? 'wr-choice--active' : ''}`} type="button" aria-pressed={config[key] === value} onMouseEnter={hover} onClick={() => { chooseSound(); setConfig((old) => ({ ...old, [key]: value })) }}>{label}</button>)}</div><p>{key === 'shuffle' ? 'Shuffling your rack can cost 1–10 points, quoted first.' : 'Swapping tiles can cost 1–10 points on top of losing your turn.'}</p></section>
            ))}
            <section className="wr-setup__rule"><h2>Rack side</h2><div className="wr-setup__options" role="group" aria-label="Rack side">{([['left', 'Left'], ['right', 'Right']] as const).map(([value, label]) => <button key={value} className={`wr-choice ${config.rackSide === value ? 'wr-choice--active' : ''}`} type="button" aria-pressed={config.rackSide === value} onMouseEnter={hover} onClick={() => { chooseSound(); setConfig((old) => ({ ...old, rackSide: value })) }}>{label}</button>)}</div><p>Which side of the board your upright rack stands on.</p></section>
            <section className="wr-setup__rule"><h2>Made-up words</h2><div className="wr-setup__options" role="group" aria-label="Made-up words">{([['no', 'Not allowed'], ['free', 'Allowed free'], ['penalty', 'Penalty Wheel']] as const).map(([value, label]) => <button key={value} className={`wr-choice ${config.madeUp === value ? 'wr-choice--active' : ''}`} type="button" aria-pressed={config.madeUp === value} onMouseEnter={hover} onClick={() => { chooseSound(); setConfig((old) => ({ ...old, madeUp: value })) }}>{label}</button>)}</div><p>Let invented words in freely, or spin the wheel for a surprise.</p></section>
          </div>
        </div>
        <footer className="wr-setup__footer"><button className="btn btn--aqua" type="button" onMouseEnter={hover} onClick={() => { sfx.play('ui-click'); onBack() }}>Back</button><button className="btn btn--pink wr-setup__start" type="button" onMouseEnter={hover} onClick={start}>Start!</button></footer>
      </section>
    </main>
  )
}
