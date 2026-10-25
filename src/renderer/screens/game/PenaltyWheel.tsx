import { useEffect, useRef, useState, type CSSProperties } from 'react'
import wheel from '@art/penalty-wheel.webp'
import pointer from '@art/wheel-pointer.webp'
import type { PenaltyOutcome } from '../../engine'
import { sfx } from '../../audio/sfx'
import '../../fx/fx.css'

export interface PenaltyWheelProps {
  slices: PenaltyOutcome[]
  landingIndex: number
  solo: boolean
  onLanded(index: number): void
}

const labels: Record<PenaltyOutcome, string> = {
  half: 'HALF POINTS', zero: 'ZERO POINTS', minus10: '−10', minus20: '−20',
  gift: 'GIFT IT!', skip: 'SKIP TURN', rackwipe: 'RACK WIPE',
  convince: 'CONVINCE THEM', lucky: 'LUCKY ESCAPE'
}

const SPIN_MS = 4500

export function PenaltyWheel({ slices, landingIndex, solo, onLanded }: PenaltyWheelProps) {
  const [landed, setLanded] = useState(false)
  const soundStarted = useRef(false)
  const outcome = slices[landingIndex]
  // The art's orange slice is centred at 12 o'clock; slice 0 therefore needs no offset.
  const endAngle = 6 * 360 - landingIndex * 45
  const spinStyle = { '--wheel-end-angle': `${endAngle}deg` } as CSSProperties

  useEffect(() => {
    if (!soundStarted.current) {
      sfx.play('wheel-spin')
      soundStarted.current = true
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      setLanded(true)
      sfx.play('wheel-land')
    }, reduced ? 0 : SPIN_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="wr-dlg" role="alertdialog" aria-label={solo ? 'Solo penalty wheel' : 'Penalty wheel'}>
      <div className="wr-dlg__box wr-wheel__box">
        <h2 className="wr-dlg__title">Spin the Penalty Wheel!</h2>
        <div className="wr-wheel__stage">
          <div className="wr-wheel__disc" style={spinStyle}>
            <img className="wr-wheel__image" src={wheel} alt="" />
            {slices.map((slice, index) => {
              const radians = index * Math.PI / 4
              const position = {
                left: `${50 + 31 * Math.sin(radians)}%`,
                top: `${50 - 31 * Math.cos(radians)}%`
              }
              return <span key={index} className="wr-wheel__slice" style={position}>{labels[slice]}</span>
            })}
          </div>
          <img className="wr-wheel__pointer" src={pointer} alt="" />
        </div>
        {landed ? (
          <div className="wr-wheel__result" role="status">
            <strong>{outcome ? labels[outcome] : ''}</strong>
            <div className="wr-dlg__row">
              <button type="button" className="btn btn--pink" onClick={() => { sfx.play('ui-click'); onLanded(landingIndex) }}>Continue</button>
            </div>
          </div>
        ) : <p className="wr-wheel__spinning" role="status">Spinning…</p>}
      </div>
    </div>
  )
}
