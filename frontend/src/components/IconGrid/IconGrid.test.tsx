import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IconGrid } from './IconGrid'

describe('IconGrid', () => {
  it('draws each cell in its tone with its key cap, as a focus target', () => {
    render(
      <IconGrid
        items={[
          { focusId: 'cat:cereal', label: '穀物', icon: 'wheat', tone: 'amber', keyCap: 1 },
          { focusId: 'cat:veg', label: '蔬菜', icon: 'cabbage', tone: 'green', keyCap: 2 },
        ]}
      />,
    )
    const cell = screen.getByText('蔬菜').parentElement
    expect(cell).toHaveAttribute('data-focus-id', 'cat:veg')
    expect(cell).toHaveAttribute('tabindex', '-1')
    expect(cell).toHaveAttribute('data-tone', 'green')
    expect(cell?.querySelector('kbd')).toHaveTextContent('2')
  })
})
