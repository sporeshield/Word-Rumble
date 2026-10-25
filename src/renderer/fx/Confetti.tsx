import type { CSSProperties } from 'react'
import './fx.css'

export interface ConfettiProps {
  pieces?: number
  duration?: number
}

const colors = ['var(--gold)', 'var(--bubblegum)', 'var(--aqua)', 'var(--tangerine)', 'var(--violet)', 'var(--mint)']

export function Confetti({ pieces = 120, duration = 4000 }: ConfettiProps) {
  return (
    <div className="wr-confetti" aria-hidden="true">
      {Array.from({ length: Math.max(0, Math.floor(pieces)) }, (_, index) => {
        const style = {
          '--confetti-x': `${(index * 73 + 17) % 101}%`,
          '--confetti-drift': `${((index * 47) % 181) - 90}px`,
          '--confetti-delay': `${duration * (((index * 137) % 200) / 1000)}ms`,
          '--confetti-duration': `${duration * (.75 + ((index * 173) % 51) / 1000)}ms`,
          '--confetti-turns': `${2 + (index % 4)}turn`,
          '--confetti-color': colors[index % colors.length]
        } as CSSProperties
        return <i key={index} className="wr-confetti__piece" style={style} />
      })}
    </div>
  )
}
