import { useEffect, useState } from 'react'
import { Rack } from '../components'
import { sfx } from '../audio/sfx'
import './screens.css'

export interface DealProps {
  names: string[]
  colors: string[]
  counts: number[]
  onDone(): void
}

export function Deal({ names, colors, counts, onDone }: DealProps) {
  const [dealt, setDealt] = useState<number[]>(() => counts.map(() => 0))
  const [done, setDone] = useState(false)
  const countKey = counts.join(',')

  useEffect(() => {
    setDealt(counts.map(() => 0))
    setDone(false)
    const timers: ReturnType<typeof setTimeout>[] = []
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let step = 0
    counts.forEach((count, player) => {
      for (let tile = 1; tile <= count; tile++) {
        step++
        const n = tile
        timers.push(setTimeout(() => {
          setDealt((previous) => previous.map((value, index) => index === player ? n : value))
          sfx.play('tile-place')
        }, reduced ? step * 35 : 350 + step * 120))
      }
    })
    timers.push(setTimeout(() => setDone(true), reduced ? step * 35 + 150 : 350 + step * 120 + 600))
    return () => timers.forEach(clearTimeout)
  }, [countKey]) // The counts sequence defines a new deal.

  return (
    <main className="wr-screen wr-deal halftone-2">
      <div className="wr-deal__content">
        <p className="wr-eyebrow">Fresh from the bag</p>
        <h1 className="wr-screen-title">Deal the tiles!</h1>
        <div className={`wr-deal__racks wr-deal__racks--${names.length} ${names.length === 1 ? 'wr-deal__racks--solo' : ''}`}>
          {names.map((name, index) => <div className="wr-deal__rack" key={index}><Rack owner={name} color={colors[index] ?? '#1cc5b4'} tiles={null} faceDown count={dealt[index] ?? 0} /></div>)}
        </div>
        {done ? <button className="btn btn--pink wr-deal__next" type="button" onMouseEnter={() => sfx.play('ui-hover')} onClick={() => { sfx.play('ui-click'); onDone() }}>Continue</button> : <p className="wr-deal__caption" role="status">A fresh rack for everyone...</p>}
      </div>
    </main>
  )
}
