import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Sparkline } from '../Sparkline/Sparkline'
import { Card, CheckBox, Chevron } from './Card'

const onion = {
  name: '洋蔥',
  spark: <Sparkline values={[20, 21, 23]} direction="up" />,
  pill: { kind: 'up', text: '4.2%' },
} as const

describe('Card', () => {
  it('shows the price with its change and 7-day trend', () => {
    const { container } = render(<Card {...onion} meta="紅洋蔥" price="2,350" />)
    expect(screen.getByText('2,350')).toBeInTheDocument()
    expect(screen.getByText('4.2%')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('shows — instead of a price when there is no data, and no trend or change', () => {
    const { container } = render(<Card {...onion} meta="無資料" price={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('無資料')).toBeInTheDocument()
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByText('4.2%')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('is a focus target only when it has a focus id', () => {
    const { container, rerender } = render(<Card name="洋蔥" focusId="crop:onion" />)
    const card = container.firstElementChild
    expect(card).toHaveAttribute('data-focus-id', 'crop:onion')
    expect(card).toHaveAttribute('tabindex', '-1')

    rerender(<Card name="洋蔥" />)
    expect(container.firstElementChild).not.toHaveAttribute('data-focus-id')
    expect(container.firstElementChild).not.toHaveAttribute('tabindex')
  })

  it('shows static bars instead of the meta and the price while loading', () => {
    const { container } = render(<Card {...onion} meta="紅洋蔥" price="2,350" loading />)
    expect(screen.getByText('洋蔥')).toBeInTheDocument()
    expect(screen.queryByText('紅洋蔥')).toBeNull()
    expect(screen.queryByText('2,350')).toBeNull()
    expect(screen.queryByText('—')).toBeNull()
    expect(container.querySelectorAll('[aria-hidden="true"]:not(svg)')).toHaveLength(2)
  })

  it('puts a chevron, with the OK key when asked, or a check box on the right', () => {
    render(<Card name="本地區 4 個市場" trailing={<Chevron okKey />} />)
    expect(screen.getByText('OK').tagName).toBe('KBD')

    const { container } = render(<Card name="洋蔥" trailing={<CheckBox checked />} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
