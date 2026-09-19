import { describe, expect, it, vi } from 'vitest'

import { followList, restoreFocus, type FocusState } from './restore'

const KEY = 'entry-1'
const at = (id: string | null, index: number): FocusState => ({ key: KEY, id, index })

describe('restoreFocus', () => {
  it('focuses the remembered item by id, not by index', () => {
    expect(restoreFocus(['crop:x', 'crop:a', 'crop:b'], KEY, 'crop:b')).toEqual(at('crop:b', 2))
  })

  it('starts on the first item when nothing was remembered or the item is gone', () => {
    expect(restoreFocus(['crop:a', 'crop:b'], KEY, null)).toEqual(at('crop:a', 0))
    expect(restoreFocus(['crop:a', 'crop:b'], KEY, 'crop:gone')).toEqual(at('crop:a', 0))
  })

  it('focuses nothing in an empty list', () => {
    expect(restoreFocus([], KEY, 'crop:a')).toEqual(at(null, -1))
  })
})

describe('followList', () => {
  const remembered = () => 'crop:b'

  it('returns the same state while the focused item stays in place', () => {
    const state = at('crop:b', 1)
    expect(followList(['crop:a', 'crop:b'], state, remembered)).toBe(state)
    const empty = at(null, -1)
    expect(followList([], empty, remembered)).toBe(empty)
  })

  it('keeps the focused item when the list changes around it', () => {
    expect(followList(['crop:x', 'crop:a', 'crop:b'], at('crop:b', 1), remembered)).toEqual(
      at('crop:b', 2),
    )
  })

  it('focuses the item now in its place when it disappears, within the list', () => {
    expect(followList(['crop:a', 'crop:c', 'crop:d'], at('crop:b', 1), remembered)).toEqual(
      at('crop:c', 1),
    )
    expect(followList(['crop:a'], at('crop:c', 2), remembered)).toEqual(at('crop:a', 0))
  })

  it('focuses nothing while the list is empty, then restores the remembered item', () => {
    const lookUp = vi.fn(remembered)
    const empty = followList([], at('crop:b', 1), lookUp)
    expect(empty).toEqual(at(null, -1))
    expect(lookUp).not.toHaveBeenCalled()
    expect(followList(['crop:a', 'crop:b'], empty, lookUp)).toEqual(at('crop:b', 1))
    expect(followList(['crop:a'], empty, lookUp)).toEqual(at('crop:a', 0))
  })
})
