import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Rack } from './Rack'

describe('face-down rack', () => {
  it('renders only the count, with no hidden letters in text or attributes', () => {
    const tiles = [
      { id: 1, letter: 'Q', points: 10 },
      { id: 2, letter: 'Z', points: 10 },
      { id: 3, letter: 'X', points: 8 }
    ]
    const markup = renderToStaticMarkup(
      <Rack owner="Player" color="#1cc5b4" tiles={tiles} count={3} faceDown />
    )

    expect(markup).not.toMatch(/[QZX]/)
    expect(markup.match(/aria-label="Face-down tile"/g)).toHaveLength(3)
    expect(markup.match(/class="wr-tile wr-tile--rack wr-tile--back"/g)).toHaveLength(3)
  })
})
