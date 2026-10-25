import { useEffect, useRef, useState } from 'react'
import bag from '@art/bag.webp'
import shakingBag from '@art/bag-shake.webp'
import { sfx } from '../audio/sfx'
import './screens.css'

export interface ShuffleBagProps { onShaken(): void }

export function ShuffleBag({ onShaken }: ShuffleBagProps) {
  const [shaking, setShaking] = useState(false)
  const busy = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const shake = () => {
    if (busy.current) return
    busy.current = true
    sfx.play('ui-click')
    sfx.play('bag-shake')
    setShaking(true)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 2200
    timer.current = setTimeout(() => { timer.current = null; onShaken() }, duration)
  }

  return (
    <main className="wr-screen wr-shuffle halftone-1">
      <div className="wr-shuffle__burst" aria-hidden="true" />
      <h1 className="wr-screen-title wr-shuffle__title">Give it a shake!</h1>
      <button
        className={`wr-shuffle__bag ${shaking ? 'wr-shuffle__bag--shaking' : ''}`}
        type="button"
        aria-label="Shake the tile bag"
        disabled={shaking}
        onMouseEnter={() => sfx.play('ui-hover')}
        onClick={shake}
      ><img src={shaking ? shakingBag : bag} alt="" /></button>
      <p className="wr-shuffle__prompt">Press the bag to shuffle the tiles!</p>
    </main>
  )
}
