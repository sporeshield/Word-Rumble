import { useEffect, useRef, useState } from 'react'
import bulb from '@art/hint-bulb.webp'
import { sfx } from '../../audio/sfx'
import '../../fx/fx.css'

export interface HintOfferDialogProps {
  cost: number | null
  rolling: boolean
  onAccept(): void
  onDecline(): void
}

export function HintOfferDialog({ cost, rolling, onAccept, onDecline }: HintOfferDialogProps) {
  const [revealed, setRevealed] = useState(!rolling || cost === null)
  const soundPlayed = useRef(false)

  useEffect(() => {
    if (!rolling || cost === null) {
      setRevealed(true)
      return
    }
    setRevealed(false)
    if (!soundPlayed.current) {
      sfx.play('dice-roll')
      soundPlayed.current = true
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setRevealed(true), reduced ? 0 : 1200)
    return () => window.clearTimeout(timer)
  }, [rolling, cost])

  const showDice = rolling && cost !== null && !revealed
  const accept = () => { sfx.play('ui-click'); onAccept() }
  const decline = () => { sfx.play('ui-click'); onDecline() }

  return (
    <div className="wr-dlg" role="alertdialog" aria-label="Hint offer">
      <div className="wr-dlg__box wr-hint__box">
        <h2 className="wr-dlg__title">Need a hint?</h2>
        <img className="wr-hint__bulb" src={bulb} alt="" />
        {showDice ? (
          <div className="wr-hint__dice" role="status" aria-label="Rolling hint cost">
            <span className="wr-hint__die wr-hint__die--one" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
            </span>
            <span className="wr-hint__die wr-hint__die--two" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
            </span>
          </div>
        ) : (
          <>
            <p className="wr-hint__cost" aria-live="polite">{cost === null ? 'Free hint!' : `−${cost} points`}</p>
            <p className="wr-dlg__text">See a move on the board.</p>
            <div className="wr-dlg__row">
              <button type="button" className="btn btn--pink" onClick={accept}>{cost === null ? 'Free hint!' : `Accept (−${cost})`}</button>
              <button type="button" className="btn btn--aqua" onClick={decline}>No thanks</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export interface NoHintDialogProps {
  onClose(): void
}

export function NoHintDialog({ onClose }: NoHintDialogProps) {
  return (
    <div className="wr-dlg" role="alertdialog" aria-label="No hint available">
      <div className="wr-dlg__box wr-hint__box">
        <h2 className="wr-dlg__title">No hint this time!</h2>
        <img className="wr-hint__bulb" src={bulb} alt="" />
        <p className="wr-dlg__text">No moves found - try swapping tiles.</p>
        <div className="wr-dlg__row">
          <button type="button" className="btn btn--pink" onClick={() => { sfx.play('ui-click'); onClose() }}>Got it</button>
        </div>
      </div>
    </div>
  )
}
