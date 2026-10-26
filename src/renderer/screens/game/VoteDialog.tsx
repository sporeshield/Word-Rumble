import { useState, type CSSProperties } from 'react'
import { sfx } from '../../audio/sfx'
import '../../fx/fx.css'

export interface VoteDialogProps {
  playerName: string
  color: string
  word: string
  /** "Vote 2 of 3", shown on the cover. */
  position?: { number: number; of: number }
  onVote(vote: 'keep' | 'zero'): void
}

/**
 * One voter at a time. The cover shows only the voter's name (the earlier votes and the word
 * stay hidden), so each vote is private; the buttons appear after "Let's go!".
 */
export function VoteDialog({ playerName, color, word, position, onVote }: VoteDialogProps) {
  const [ready, setReady] = useState(false)
  const vote = (choice: 'keep' | 'zero') => {
    sfx.play('ui-click')
    onVote(choice)
  }

  return (
    <div className="wr-dlg wr-vote" role="alertdialog" aria-label="Vote on a made-up word" style={{ '--plate': color } as CSSProperties}>
      <div className="wr-dlg__box">
        <h2 className="wr-dlg__title">Convince them!</h2>
        {!ready ? (
          <>
            <p className="wr-dlg__text">
              <strong className="wr-vote__name">{playerName}</strong>, take the laptop for a secret vote!
              {position && position.of > 1 ? <span className="wr-vote__count"> (vote {position.number} of {position.of})</span> : null}
            </p>
            <div className="wr-dlg__row">
              <button type="button" className="btn btn--pink" onClick={() => { sfx.play('flip-see'); setReady(true) }}>Let's go!</button>
            </div>
          </>
        ) : (
          <>
            <p className="wr-dlg__text"><strong className="wr-vote__name">{playerName}</strong>, does <span className="wr-fx__word">{word}</span> count?</p>
            <div className="wr-dlg__row wr-vote__row">
              <button type="button" className="btn btn--aqua wr-vote__button" onClick={() => vote('keep')}>
                <span className="wr-vote__icon" aria-hidden="true">👍</span> Keep it!
              </button>
              <button type="button" className="btn btn--pink wr-vote__button" onClick={() => vote('zero')}>
                <span className="wr-vote__icon" aria-hidden="true">👎</span> Zero points!
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
