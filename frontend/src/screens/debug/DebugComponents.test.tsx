import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import DebugComponents from './DebugComponents'

describe('DebugComponents', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders every component without console errors', () => {
    const errors = vi.spyOn(console, 'error')
    const { container } = render(<DebugComponents />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(container.querySelectorAll('svg.large, svg.small')).toHaveLength(4)
    expect(errors).not.toHaveBeenCalled()
  })

  it('moves the real focus through the selectable items with ↑ ↓', () => {
    const { container } = render(<DebugComponents />)
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-focus-id]'))
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[0])
  })
})
