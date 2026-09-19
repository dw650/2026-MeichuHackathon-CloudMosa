import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CropIcon } from './CropIcon'

const tile = (container: HTMLElement) => container.firstElementChild

describe('CropIcon', () => {
  it("colours the tile by the crop category's tone", () => {
    const { container } = render(<CropIcon crop="onion" tone="green" />)
    expect(tile(container)).toHaveAttribute('data-tone', 'green')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('uses the "other" colour without a tone', () => {
    const { container } = render(<CropIcon crop="durian" />)
    expect(tile(container)).toHaveAttribute('data-tone', 'slate')
  })

  it('draws the number key cap on the tile', () => {
    render(<CropIcon crop="onion" tone="green" keyCap={1} />)
    expect(screen.getByText('1').tagName).toBe('KBD')
  })
})
