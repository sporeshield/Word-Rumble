import titleBg from '@art/title-bg.webp'
import { sfx } from '../audio/sfx'
import './screens.css'

export interface TitleProps {
  canContinue: boolean
  onNewGame(): void
  onContinue(): void
  onScores(): void
  onSettings(): void
  onQuit(): void
}

export function Title({ canContinue, onNewGame, onContinue, onScores, onSettings, onQuit }: TitleProps) {
  const actions = [
    { label: 'New Game', action: onNewGame, style: 'btn--pink', disabled: false },
    { label: 'Continue Game', action: onContinue, style: 'btn--aqua', disabled: !canContinue },
    { label: 'High Scores', action: onScores, style: '', disabled: false },
    { label: 'Settings', action: onSettings, style: 'btn--aqua', disabled: false },
    { label: 'Quit', action: onQuit, style: 'btn--pink', disabled: false }
  ]

  return (
    <main className="wr-screen wr-title" style={{ backgroundImage: `url(${titleBg})` }}>
      <div className="wr-title__content">
        <div className="wr-title__logo" aria-label="Word Rumble">
          <span className="wr-title__word" aria-hidden="true">WORD</span>
          <span className="wr-title__word wr-title__word--second" aria-hidden="true">RUMBLE</span>
        </div>
        <div className="wr-title__buttons">
          {actions.map(({ label, action, style, disabled }, index) => (
            <button
              className={`btn wr-title__button ${style}`}
              key={label}
              type="button"
              disabled={disabled}
              style={{ animationDelay: `${index * 90}ms` }}
              onMouseEnter={() => sfx.play('ui-hover')}
              onClick={() => { sfx.play('ui-click'); action() }}
            >{label}</button>
          ))}
        </div>
      </div>
    </main>
  )
}
