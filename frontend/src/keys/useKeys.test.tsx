import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { KeyHandlers } from './keyScope'
import { useKeys } from './useKeys'

function Panel({ keys }: { keys: KeyHandlers }) {
  useKeys(keys, { layer: 'overlay' })
  return null
}

/** A screen that renders its panel inside itself, as the real screens will. */
function Screen({ keys, panel }: { keys: KeyHandlers; panel?: KeyHandlers }) {
  useKeys(keys)
  return panel ? <Panel keys={panel} /> : null
}

/** Returns false when the keydown was preventDefault-ed. */
const pressDown = () => fireEvent.keyDown(document.body, { key: 'ArrowDown' })

describe('useKeys', () => {
  it('gives a panel inside a screen the keys, even when both mount in one commit', () => {
    const screenKeys = { onDown: vi.fn() }
    const panelKeys = { onDown: vi.fn() }
    const { rerender } = render(
      <StrictMode>
        <Screen keys={screenKeys} panel={panelKeys} />
      </StrictMode>,
    )
    pressDown()
    expect(panelKeys.onDown).toHaveBeenCalledOnce()
    expect(screenKeys.onDown).not.toHaveBeenCalled()

    rerender(
      <StrictMode>
        <Screen keys={screenKeys} />
      </StrictMode>,
    )
    pressDown()
    expect(screenKeys.onDown).toHaveBeenCalledOnce()
  })

  it('blocks the screen while a panel opened later is open, then hands the keys back', () => {
    const screenKeys = { onDown: vi.fn(), onStar: vi.fn() }
    const panelKeys = { onDown: vi.fn() }
    const { rerender } = render(<Screen keys={screenKeys} />)
    rerender(<Screen keys={screenKeys} panel={panelKeys} />)
    pressDown()
    fireEvent.keyDown(document.body, { key: '*' })
    expect(panelKeys.onDown).toHaveBeenCalledOnce()
    expect(screenKeys.onDown).not.toHaveBeenCalled()
    expect(screenKeys.onStar).not.toHaveBeenCalled()

    rerender(<Screen keys={screenKeys} />)
    pressDown()
    expect(screenKeys.onDown).toHaveBeenCalledOnce()
  })

  it('always calls the latest handlers', () => {
    function Counter() {
      const [count, setCount] = useState(0)
      useKeys({ onUp: () => setCount(count + 1) })
      return <output>{count}</output>
    }
    render(<Counter />)
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(document.body, { key: 'ArrowUp' })
    expect(screen.getByRole('status')).toHaveTextContent('3')
  })

  it('keeps its place in the stack when it re-renders', () => {
    const olderDown = vi.fn()
    const newerDown = vi.fn()
    function Older() {
      const [renders, setRenders] = useState(0)
      useKeys({ onDown: () => olderDown(renders) })
      return <button onClick={() => setRenders(renders + 1)}>re-render</button>
    }
    render(
      <>
        <Older />
        <Screen keys={{ onDown: newerDown }} />
      </>,
    )
    fireEvent.click(screen.getByRole('button'))
    pressDown()
    expect(newerDown).toHaveBeenCalledOnce()
    expect(olderDown).not.toHaveBeenCalled()
  })

  it('stops handling keys once unmounted', () => {
    const keys = { onDown: vi.fn() }
    const { unmount } = render(<Screen keys={keys} />)
    unmount()
    expect(pressDown()).toBe(true)
    expect(keys.onDown).not.toHaveBeenCalled()
  })

  it('runs OK once on a focused button instead of also clicking it', async () => {
    const user = userEvent.setup()
    const onEnter = vi.fn()
    const onClick = vi.fn()
    function Item() {
      useKeys({ onEnter })
      return <button onClick={onClick}>item</button>
    }
    render(<Item />)
    screen.getByRole('button').focus()
    await user.keyboard('{Enter}')
    expect(onEnter).toHaveBeenCalledOnce()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('maps keyboard keys by event.key: Escape opens the menu, # and * are not digits', async () => {
    const user = userEvent.setup()
    const keys = { onMenu: vi.fn(), onHash: vi.fn(), onStar: vi.fn(), onDigit: vi.fn() }
    render(<Screen keys={keys} />)
    await user.keyboard('{Escape}#*3')
    expect(keys.onMenu).toHaveBeenCalledOnce()
    expect(keys.onHash).toHaveBeenCalledOnce()
    expect(keys.onStar).toHaveBeenCalledOnce()
    expect(keys.onDigit.mock.calls).toEqual([[3]])
  })
})
