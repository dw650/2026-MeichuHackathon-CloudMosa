import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UpIsPosContext } from '../rise'
import { MetricGrid } from './MetricGrid'

describe('MetricGrid', () => {
  it('shows each metric with its label and colours rises by the country', () => {
    render(
      <UpIsPosContext value={false}>
        <MetricGrid
          items={[
            { label: '比 7 日均價', value: '+3.1%', direction: 'up' },
            { label: '到貨量', value: '偏多 ▲18%' },
          ]}
        />
      </UpIsPosContext>,
    )
    expect(screen.getByText('比 7 日均價')).toBeInTheDocument()
    expect(screen.getByText('+3.1%')).toHaveClass('neg')
    expect(screen.getByText('偏多 ▲18%')).not.toHaveClass('pos')
    expect(screen.getByText('偏多 ▲18%')).not.toHaveClass('neg')
  })

  it('draws the 30-day position gauge, kept between 0 and 100%', () => {
    const { container } = render(
      <MetricGrid
        items={[
          { label: 'a', value: '72%', gauge: 0.72 },
          { label: 'b', value: '—', gauge: 1.4 },
          { label: 'c', value: '—', gauge: -0.2 },
        ]}
        tone="green"
      />,
    )
    const fills = Array.from(container.querySelectorAll<HTMLElement>('.fill'), (f) => f.style.width)
    expect(fills).toEqual(['72%', '100%', '0%'])
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'green')
  })
})
