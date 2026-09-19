import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'

import { UpIsPosContext } from '../rise'
import { Pill } from './Pill'

const IN = true // India: rising prices are green
const TW = false // Taiwan: rising prices are red

function renderPill(ui: ReactElement, upIsPos?: boolean) {
  const tree = upIsPos === undefined ? ui : <UpIsPosContext value={upIsPos}>{ui}</UpIsPosContext>
  const pill = render(tree).container.firstElementChild
  if (!pill) throw new Error('no pill')
  return pill
}

describe('Pill', () => {
  it('marks a rise with ▲, green in India and red in Taiwan', () => {
    const india = renderPill(<Pill kind="up" text="4.2%" />, IN)
    expect(india).toHaveTextContent('▲4.2%')
    expect(india).toHaveClass('pos')

    const taiwan = renderPill(<Pill kind="up" text="4.2%" />, TW)
    expect(taiwan).toHaveTextContent('▲4.2%')
    expect(taiwan).toHaveClass('neg')
  })

  it('marks a fall with ▼, red in India and green in Taiwan', () => {
    const india = renderPill(<Pill kind="down" text="12%" />, IN)
    expect(india).toHaveTextContent('▼12%')
    expect(india).toHaveClass('neg')

    expect(renderPill(<Pill kind="down" text="12%" />, TW)).toHaveClass('pos')
  })

  it('marks no change with ＝ in the flat colour in both countries', () => {
    const india = renderPill(<Pill kind="flat" text="0%" />, IN)
    expect(india).toHaveTextContent('＝0%')
    expect(india).toHaveClass('flat')
    expect(renderPill(<Pill kind="flat" text="0%" />, TW)).toHaveClass('flat')
  })

  it('follows the Indian colours when no country is set', () => {
    expect(renderPill(<Pill kind="up" text="1%" />)).toHaveClass('pos')
  })

  it('shows old data and your own area as text without a glyph', () => {
    const old = renderPill(<Pill kind="old" text="舊" />, TW)
    expect(old).toHaveTextContent(/^舊$/)
    expect(old).toHaveClass('old')

    const you = renderPill(<Pill kind="you" text="你" />, TW)
    expect(you).toHaveTextContent(/^你$/)
    expect(you).toHaveClass('you')
  })
})
