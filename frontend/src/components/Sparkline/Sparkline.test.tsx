import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UpIsPosContext } from '../rise'
import { Sparkline } from './Sparkline'

const svgOf = (container: HTMLElement) => {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no sparkline')
  return svg
}

describe('Sparkline', () => {
  it('draws the week with a solid dot on the last price', () => {
    const svg = svgOf(render(<Sparkline values={[3, 4, 5, 4, 6]} direction="up" />).container)
    expect(svg.querySelector('path')?.getAttribute('d')?.match(/[ML]/g)).toHaveLength(5)
    expect(svg.querySelectorAll('circle')).toHaveLength(1)
  })

  it('joins the days around a day without a price', () => {
    const svg = svgOf(render(<Sparkline values={[3, null, 5, 4]} direction="up" />).container)
    expect(svg.querySelector('path')?.getAttribute('d')?.match(/[ML]/g)?.join('')).toBe('MLL')
  })

  it('takes the colour of the change, which follows the country', () => {
    const india = svgOf(render(<Sparkline values={[3, 4]} direction="up" />).container)
    expect(india).toHaveClass('pos')
    const taiwan = svgOf(
      render(
        <UpIsPosContext value={false}>
          <Sparkline values={[3, 4]} direction="up" />
        </UpIsPosContext>,
      ).container,
    )
    expect(taiwan).toHaveClass('neg')
  })

  it('keeps its size but draws nothing without prices', () => {
    const svg = svgOf(render(<Sparkline values={[null, null]} direction="flat" />).container)
    expect(svg.childElementCount).toBe(0)
    expect(svg).toHaveAttribute('width', '38')
  })

  it('draws only the dot for a single price', () => {
    const svg = svgOf(render(<Sparkline values={[null, 7]} direction="flat" />).container)
    expect(svg.querySelector('path')).toBeNull()
    expect(svg.querySelectorAll('circle')).toHaveLength(1)
  })
})
