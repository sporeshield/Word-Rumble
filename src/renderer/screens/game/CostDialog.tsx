import { useEffect, useState } from 'react'
import { sfx } from '../../audio/sfx'
import '../../fx/fx.css'

export type CostKind = 'shuffle' | 'swap'

export interface CostQuoteDialogProps {
  kind: CostKind
  cost: number
  /** True the first time this quote is shown: the dice tumble before the number appears. */
  rolling: boolean
  onAccept(): void
  onDecline(): void
}

const COPY: Record<CostKind, { title: string; line: (cost: number) => string; accept: (cost: number) => string }> = {
  shuffle: {
    title: 'Shuffle your rack?',
    line: (cost) => `Shuffling your rack will cost you ${cost} ${cost === 1 ? 'point' : 'points'}`,
    accept: (cost) => `Shuffle (−${cost})`
  },
  swap: {
    title: 'Swap tiles?',
    line: (cost) => `Swapping costs ${cost} ${cost === 1 ? 'point' : 'points'} and ends your turn`,
    accept: () => 'Pick tiles'
  }
}

/** Cartoon warning shown before a costly Shuffle or Swap; only the cost is shown, never a total. */
export function CostQuoteDialog({ kind, cost, rolling, onAccept, onDecline }: CostQuoteDialogProps) {
  const [revealed, setRevealed] = useState(!rolling)

  useEffect(() => {
    if (!rolling) { setRevealed(true); return }
    setRevealed(false)
    sfx.play('dice-roll')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => { setRevealed(true); sfx.play('wheel-land') /* stand-in until Phase 17 adds penalty-cost */ }, reduced ? 0 : 1200)
    return () => window.clearTimeout(timer)
  }, [rolling])

  const copy = COPY[kind]
  return (
    <div className="wr-dlg" role="alertdialog" aria-label={copy.title}>
      <div className="wr-dlg__box wr-hint__box">
        <h2 className="wr-dlg__title">{copy.title}</h2>
        {!revealed ? (
          <div className="wr-hint__dice" role="status" aria-label="Rolling the cost">
            <span className="wr-hint__die wr-hint__die--one" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
            </span>
            <span className="wr-hint__die wr-hint__die--two" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
            </span>
          </div>
        ) : (
          <>
            <p className="wr-hint__cost" aria-live="polite">−{cost} {cost === 1 ? 'point' : 'points'}</p>
            <p className="wr-dlg__text">{copy.line(cost)}</p>
            <div className="wr-dlg__row">
              <button type="button" className="btn btn--pink" onClick={() => { sfx.play('ui-click'); onAccept() }}>{copy.accept(cost)}</button>
              <button type="button" className="btn btn--aqua" onClick={() => { sfx.play('ui-click'); onDecline() }}>No thanks</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
