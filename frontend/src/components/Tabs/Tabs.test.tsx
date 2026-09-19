import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Tabs } from './Tabs'

const TABS = [
  { id: 'trend', label: '走勢' },
  { id: 'today', label: '行情' },
  { id: 'compare', label: '比價' },
]

describe('Tabs', () => {
  it('marks only the current tab as selected', () => {
    render(<Tabs tabs={TABS} activeId="today" />)
    expect(screen.getByRole('tab', { name: '行情' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '走勢' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: '比價' })).toHaveAttribute('aria-selected', 'false')
  })

  it('draws ◀ ▶ on both sides as the hint for switching tabs', () => {
    const { container } = render(<Tabs tabs={TABS} activeId="trend" />)
    expect(container).toHaveTextContent(/^◀走勢行情比價▶$/)
  })

  it('is not a focus stop: tabs change with ◀ ▶, not by focusing them', () => {
    const { container } = render(<Tabs tabs={TABS} activeId="trend" />)
    expect(container.querySelector('[tabindex], [data-focus-id]')).toBeNull()
  })
})
