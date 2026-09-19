import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Shell } from './Shell'

describe('Shell', () => {
  it('shows the left, center and right soft key labels', () => {
    render(
      <Shell title="Nashik prices" softKeys={{ left: 'Menu', center: 'Open', right: 'Exit' }}>
        <p>content</p>
      </Shell>,
    )
    expect(screen.getByText('Menu')).toHaveAttribute('data-softkey', 'left')
    expect(screen.getByText('Open')).toHaveAttribute('data-softkey', 'center')
    expect(screen.getByText('Exit')).toHaveAttribute('data-softkey', 'right')
  })

  it('renders the title and the content', () => {
    render(
      <Shell title="Nashik prices" softKeys={{}}>
        <p>content</p>
      </Shell>,
    )
    expect(screen.getByRole('heading', { name: 'Nashik prices' })).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
