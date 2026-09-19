import { afterEach, describe, expect, it, vi } from 'vitest'

import { pushKeyScope, type KeyHandlers, type KeyLayer } from './keyScope'

const removers: Array<() => void> = []

afterEach(() => {
  removers.splice(0).forEach((remove) => remove())
  vi.restoreAllMocks()
})

/** Registers a scope for the current test only. */
function scope(handlers: KeyHandlers, layer?: KeyLayer): () => void {
  const remove = pushKeyScope(() => handlers, layer)
  removers.push(remove)
  return remove
}

function allHandlers() {
  return {
    onUp: vi.fn(),
    onDown: vi.fn(),
    onLeft: vi.fn(),
    onRight: vi.fn(),
    onEnter: vi.fn(),
    onMenu: vi.fn(),
    onStar: vi.fn(),
    onHash: vi.fn(),
    onDigit: vi.fn<(digit: number) => void>(),
  } satisfies Required<KeyHandlers>
}

/** Fires a cancelable keydown from the focused element; it bubbles up to window. */
function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  document.body.dispatchEvent(event)
  return event
}

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
const OTHER_KEYS = ['Enter', 'Escape', '*', '#', '0', '5']

describe('key mapping', () => {
  it.each([
    ['ArrowUp', 'onUp'],
    ['ArrowDown', 'onDown'],
    ['ArrowLeft', 'onLeft'],
    ['ArrowRight', 'onRight'],
    ['Enter', 'onEnter'],
    ['Escape', 'onMenu'],
    ['*', 'onStar'],
    ['#', 'onHash'],
  ] as const)('sends %s to %s only', (key, name) => {
    const handlers = allHandlers()
    scope(handlers)
    press(key)
    for (const [other, handler] of Object.entries(handlers)) {
      expect(handler).toHaveBeenCalledTimes(other === name ? 1 : 0)
    }
  })

  it('sends 0-9 to onDigit as numbers', () => {
    const onDigit = vi.fn()
    scope({ onDigit })
    for (const key of '0123456789') press(key)
    expect(onDigit.mock.calls).toEqual([[0], [1], [2], [3], [4], [5], [6], [7], [8], [9]])
  })

  it('tells # and * from digits by event.key only (their code and keyCode match a digit)', () => {
    const handlers = allHandlers()
    scope(handlers)
    press('#', { code: 'Digit3', keyCode: 51, shiftKey: true })
    press('*', { code: 'Digit8', keyCode: 56, shiftKey: true })
    press('3', { code: 'Digit3', keyCode: 51 })
    expect(handlers.onHash).toHaveBeenCalledOnce()
    expect(handlers.onStar).toHaveBeenCalledOnce()
    expect(handlers.onDigit.mock.calls).toEqual([[3]])
  })

  it('reads the handlers when the key arrives', () => {
    let handlers: KeyHandlers = {}
    removers.push(pushKeyScope(() => handlers))
    press('ArrowDown')
    const onDown = vi.fn()
    handlers = { onDown }
    press('ArrowDown')
    expect(onDown).toHaveBeenCalledOnce()
  })
})

describe('scope stack', () => {
  it('sends keys to the newest scope only, then back to the one below once it is removed', () => {
    const below = allHandlers()
    const top = allHandlers()
    scope(below)
    const removeTop = scope(top)
    press('ArrowDown')
    expect(top.onDown).toHaveBeenCalledOnce()
    expect(below.onDown).not.toHaveBeenCalled()

    removeTop()
    press('ArrowDown')
    expect(below.onDown).toHaveBeenCalledOnce()
    expect(top.onDown).toHaveBeenCalledOnce()
  })

  it('keeps an overlay above screens, even screens registered after it', () => {
    // React runs a child's effects first, so a panel inside a screen registers before it.
    const panel = allHandlers()
    const screen = allHandlers()
    scope(panel, 'overlay')
    scope(screen)
    press('ArrowDown')
    expect(panel.onDown).toHaveBeenCalledOnce()
    expect(screen.onDown).not.toHaveBeenCalled()
  })

  it('never lets keys fall through to the screen below an open panel', () => {
    const screen = allHandlers()
    scope(screen)
    scope({ onDown: vi.fn() }, 'overlay')
    for (const key of [...ARROWS, ...OTHER_KEYS]) press(key)
    for (const handler of Object.values(screen)) expect(handler).not.toHaveBeenCalled()
  })
})

describe('held keys', () => {
  it('repeat only for the arrow keys', () => {
    const handlers = allHandlers()
    scope(handlers)
    for (const key of [...ARROWS, ...OTHER_KEYS]) press(key, { repeat: true })
    for (const name of ['onUp', 'onDown', 'onLeft', 'onRight'] as const) {
      expect(handlers[name]).toHaveBeenCalledOnce()
    }
    for (const name of ['onEnter', 'onMenu', 'onStar', 'onHash', 'onDigit'] as const) {
      expect(handlers[name]).not.toHaveBeenCalled()
    }
  })
})

describe('preventDefault', () => {
  it('stops the browser default of handled keys only', () => {
    scope({ onDown: vi.fn(), onHash: vi.fn(), onDigit: vi.fn() })
    expect(press('ArrowDown').defaultPrevented).toBe(true)
    expect(press('#').defaultPrevented).toBe(true)
    expect(press('7').defaultPrevented).toBe(true)
    // A swallowed repeat is still ours.
    expect(press('#', { repeat: true }).defaultPrevented).toBe(true)

    expect(press('ArrowUp').defaultPrevented).toBe(false)
    expect(press('Escape').defaultPrevented).toBe(false)
    expect(press('Tab').defaultPrevented).toBe(false)
  })

  it('always stops Enter so a focused button does not click as well', () => {
    scope({})
    expect(press('Enter').defaultPrevented).toBe(true)
    expect(press('Enter', { repeat: true }).defaultPrevented).toBe(true)
  })
})

describe('ignored events', () => {
  it('skips Ctrl, Meta and Alt shortcuts but not Shift (desktop # and * need it)', () => {
    const handlers = allHandlers()
    scope(handlers)
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(press('Enter', { [modifier]: true }).defaultPrevented).toBe(false)
      press('ArrowDown', { [modifier]: true })
    }
    expect(handlers.onEnter).not.toHaveBeenCalled()
    expect(handlers.onDown).not.toHaveBeenCalled()

    press('#', { shiftKey: true })
    expect(handlers.onHash).toHaveBeenCalledOnce()
  })

  it('skips keys while an input method is composing', () => {
    const handlers = allHandlers()
    scope(handlers)
    expect(press('Enter', { isComposing: true }).defaultPrevented).toBe(false)
    expect(handlers.onEnter).not.toHaveBeenCalled()
  })
})

describe('window listener', () => {
  const keydownCalls = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter(([type]) => type === 'keydown').length

  it('is a single keydown listener that exists only while scopes do', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const handlers = allHandlers()
    const removeFirst = scope(handlers)
    const removeSecond = scope({})
    expect(keydownCalls(add)).toBe(1)

    removeSecond()
    removeFirst()
    removeFirst() // removing twice is harmless
    expect(keydownCalls(remove)).toBe(1)

    expect(press('Enter').defaultPrevented).toBe(false)
    press('ArrowDown')
    expect(handlers.onDown).not.toHaveBeenCalled()
  })
})
