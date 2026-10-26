import { useEffect } from 'react'
import burst1 from '@art/burst-1.webp'
import burst2 from '@art/burst-2.webp'
import burst3 from '@art/burst-3.webp'
import burst4 from '@art/burst-4.webp'
import './fx.css'

export type ComicBurstTier = 'dl' | 'tl' | 'dw' | 'tw' | 'top' | 'fibber' | 'hint' | 'timeout' | 'power5' | 'power10' | 'quad' | 'powerword5' | 'powerword10'

export interface ComicBurstProps {
  text: string
  tier: ComicBurstTier
  onDone?(): void
}

const art: Record<ComicBurstTier, string> = {
  dl: burst4, hint: burst4, tl: burst2, dw: burst1,
  tw: burst3, top: burst3, fibber: burst3, timeout: burst2,
  power5: burst1, power10: burst3, quad: burst3, powerword5: burst3, powerword10: burst3
}

export function ComicBurst({ text, tier, onDone }: ComicBurstProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone?.(), 1400)
    return () => window.clearTimeout(timer)
  }, [onDone, text, tier])

  return (
    <div className={`wr-comic-burst wr-comic-burst--${tier}`} aria-live="polite">
      <div className="wr-comic-burst__art">
        <div className="wr-comic-burst__rays" aria-hidden="true" />
        <img src={art[tier]} alt="" />
        <span className="wr-comic-burst__text">{text}</span>
      </div>
    </div>
  )
}
