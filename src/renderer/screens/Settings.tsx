import { sfx } from '../audio/sfx'
import './screens.css'

export interface SettingsProps {
  volume: number
  muted: boolean
  onVolume(value: number): void
  onMuted(muted: boolean): void
  onResetScores(): void
  /** Present only in the packaged game (dev has no exe to point at). */
  onShortcut?(): void
  onClose(): void
}

export function Settings({ volume, muted, onVolume, onMuted, onResetScores, onShortcut, onClose }: SettingsProps) {
  const click = (action: () => void, toggle = false) => {
    sfx.play('ui-click')
    if (toggle) sfx.play('ui-toggle')
    action()
  }

  return (
    <main className="wr-screen wr-settings halftone-2">
      <section className="wr-panel wr-settings__panel" aria-labelledby="wr-settings-title">
        <span className="wr-panel__spark wr-panel__spark--one" aria-hidden="true">✦</span>
        <span className="wr-panel__spark wr-panel__spark--two" aria-hidden="true">✦</span>
        <h1 id="wr-settings-title" className="wr-screen-title">Settings</h1>
        <div className="wr-settings__volume">
          <div className="wr-settings__volume-head"><label htmlFor="wr-volume">Sound volume</label><output>{Math.round(volume * 100)}%</output></div>
          <input
            id="wr-volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            style={{ '--wr-progress': `${volume * 100}%` } as React.CSSProperties}
            aria-label="Sound volume"
            onMouseEnter={() => sfx.play('ui-hover')}
            onClick={() => sfx.play('ui-click')}
            onChange={(event) => onVolume(Number(event.currentTarget.value))}
          />
        </div>
        <button
          className={`wr-settings__mute ${muted ? 'wr-settings__mute--on' : ''}`}
          type="button"
          role="switch"
          aria-checked={muted}
          onMouseEnter={() => sfx.play('ui-hover')}
          onClick={() => click(() => onMuted(!muted), true)}
        >
          <span>Mute sound</span><span className="wr-settings__switch" aria-hidden="true"><span /></span>
        </button>
        {onShortcut && (
          <button className="btn btn--aqua" type="button" onMouseEnter={() => sfx.play('ui-hover')} onClick={() => click(onShortcut)}>Desktop shortcut</button>
        )}
        <div className="wr-settings__footer">
          <button className="btn btn--pink" type="button" onMouseEnter={() => sfx.play('ui-hover')} onClick={() => click(onResetScores)}>Reset scores</button>
          <button className="btn btn--aqua" type="button" onMouseEnter={() => sfx.play('ui-hover')} onClick={() => click(onClose)}>Close</button>
        </div>
      </section>
    </main>
  )
}
