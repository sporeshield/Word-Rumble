import type { CSSProperties } from 'react'
import laptop from '@art/take-laptop.webp'
import { sfx } from '../audio/sfx'
import './screens.css'

export interface HandoffProps {
  name: string
  color: string
  onGo(): void
  subtitle?: string
}

export function Handoff({ name, color, onGo, subtitle }: HandoffProps) {
  return (
    <main className="wr-screen wr-handoff halftone-3" style={{ '--wr-handoff-color': color } as CSSProperties}>
      <div className="wr-handoff__card">
        <img className="wr-handoff__art" src={laptop} alt="" />
        <div className="wr-handoff__copy">
          <p className="wr-handoff__eyebrow">Your turn!</p>
          <h1><span>{name}</span><br />take the laptop!</h1>
          {subtitle ? <p className="wr-handoff__subtitle">{subtitle}</p> : null}
          <button className="btn btn--pink wr-handoff__go" type="button" onMouseEnter={() => sfx.play('ui-hover')} onClick={() => { sfx.play('ui-click'); onGo() }}>Let's go!</button>
        </div>
      </div>
    </main>
  )
}
