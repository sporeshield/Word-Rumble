import { sfx } from '../../audio/sfx'
import '../../fx/fx.css'

export interface VoteDialogProps {
  playerName: string
  word: string
  onVote(vote: 'keep' | 'zero'): void
}

export function VoteDialog({ playerName, word, onVote }: VoteDialogProps) {
  const vote = (choice: 'keep' | 'zero') => {
    sfx.play('ui-click')
    onVote(choice)
  }

  return (
    <div className="wr-dlg" role="alertdialog" aria-label="Vote on a made-up word">
      <div className="wr-dlg__box">
        <h2 className="wr-dlg__title">Convince them!</h2>
        <p className="wr-dlg__text"><strong>{playerName}</strong>, does <span className="wr-fx__word">{word}</span> count?</p>
        <div className="wr-dlg__row wr-vote__row">
          <button type="button" className="btn btn--aqua wr-vote__button" onClick={() => vote('keep')}>
            <span className="wr-vote__icon" aria-hidden="true">👍</span> Keep it!
          </button>
          <button type="button" className="btn btn--pink wr-vote__button" onClick={() => vote('zero')}>
            <span className="wr-vote__icon" aria-hidden="true">👎</span> Zero points!
          </button>
        </div>
      </div>
    </div>
  )
}
