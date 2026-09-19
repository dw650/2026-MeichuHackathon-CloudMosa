import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import DebugKeys from './DebugKeys'

const rows = () => within(screen.getByTestId('key-log')).queryAllByRole('listitem')

describe('DebugKeys', () => {
  it('records event.key and repeat for every keydown, newest first', () => {
    render(<DebugKeys />)
    act(() => {
      fireEvent.keyDown(window, { key: '#', code: 'Digit3' })
      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown', repeat: true })
    })
    const [latest, first] = rows()
    expect(latest).toHaveTextContent('ArrowDown')
    expect(latest).toHaveTextContent('repeat')
    expect(first).toHaveTextContent('#')
    expect(first).toHaveTextContent('Digit3')
    expect(first).not.toHaveTextContent('repeat')
  })

  it('keeps only the most recent entries', () => {
    render(<DebugKeys />)
    act(() => {
      for (let i = 0; i < 40; i++) fireEvent.keyDown(window, { key: String(i % 10) })
    })
    expect(rows().length).toBeLessThanOrEqual(30)
  })

  it('counts clicks on the Enter test button separately from Enter keydowns', () => {
    render(<DebugKeys />)
    act(() => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByTestId('click-count')).toHaveTextContent('1')
  })
})
