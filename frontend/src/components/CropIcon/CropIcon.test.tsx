import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CropIcon } from './CropIcon'

const tile = (container: HTMLElement) => container.firstElementChild

describe('CropIcon', () => {
  it('colours the tile by the crop category', () => {
    const { container } = render(<CropIcon crop="onion" category="veg" />)
    expect(tile(container)).toHaveAttribute('data-tone', 'green')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('uses the "other" colour when the category is unknown', () => {
    const { container } = render(<CropIcon crop="durian" category="exotic" />)
    expect(tile(container)).toHaveAttribute('data-tone', 'slate')
  })

  it('draws the number key cap on the tile', () => {
    render(<CropIcon crop="onion" category="veg" keyCap={1} />)
    expect(screen.getByText('1').tagName).toBe('KBD')
  })
})
