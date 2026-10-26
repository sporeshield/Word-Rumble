import type { CSSProperties } from 'react'
import { sfx } from '../../audio/sfx'

export interface SeatChoice {
  index: number
  name: string
  color: string
}

interface RecipientProps {
  title: string
  text: string
  label: string
  seats: SeatChoice[]
  /** Drop-out only: "Nobody" keeps the points with the dropper. */
  allowNobody?: boolean
  onPick(index: number | null): void
  onCancel?(): void
}

/** Name plates in player colours. Never shows scores or letters. */
export function RecipientDialog({ title, text, label, seats, allowNobody, onPick, onCancel }: RecipientProps) {
  const pick = (index: number | null) => { sfx.play('ui-click'); onPick(index) }
  return (
    <div className="wr-dlg" role="alertdialog" aria-label={label}>
      <div className="wr-dlg__box">
        <h2 className="wr-dlg__title">{title}</h2>
        <p className="wr-dlg__text">{text}</p>
        <div className="wr-dlg__stack wr-recipients">
          {seats.map((seat) => (
            <button
              type="button" key={seat.index} className="btn wr-recipients__plate"
              style={{ '--plate': seat.color } as CSSProperties}
              onClick={() => pick(seat.index)}
            >
              {seat.name}
            </button>
          ))}
          {allowNobody ? <button type="button" className="btn wr-recipients__nobody" onClick={() => pick(null)}>Nobody</button> : null}
        </div>
        {onCancel ? (
          <div className="wr-dlg__row">
            <button type="button" className="btn btn--aqua" onClick={() => { sfx.play('ui-click'); onCancel() }}>Keep playing</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
