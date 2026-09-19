import { useLayoutEffect, type RefObject } from 'react'

import type { KeyHandlers } from '@/keys/keyScope'

import { findItem, keepInView, scrollPage, scrollParent } from './dom'
import { useRestoredFocus } from './restore'

export interface FocusListOptions {
  /**
   * The element that contains the items; the screen creates it with `useRef` and puts it on the
   * list (or the page content when there are no items). It scrolls if it has
   * `overflow-y: auto | scroll`, otherwise its nearest ancestor that does (the Shell content).
   */
  root: RefObject<HTMLElement | null>
  /** Called with an item's id on OK, or on the digit of the key cap it shows. */
  onActivate?: (id: string) => void
  /**
   * Leading items without a digit key cap, such as the connection-failed card above the home
   * list (docs/02 §6): digit 1 then opens `ids[digitOffset]`. Default 0.
   */
  digitOffset?: number
  /**
   * False while a panel is open above this list (docs/03 §5): the focus is left to the panel
   * and comes back to the same item when the panel closes. Default true.
   */
  active?: boolean
}

export interface FocusList {
  /** The focused item's id; `null` while the list is empty. */
  readonly focusedId: string | null
  /** Key handlers to merge into the screen's single `useKeys` call. */
  readonly keys: KeyHandlers
  /** Focuses an item, e.g. on a mouse click, and remembers it at once. */
  focus(id: string): void
}

/**
 * Focus for a vertical list of items (docs/04 §4.4, docs/02 §4): ↑ ↓ move and stop at both ends,
 * OK and digits 1–9 open an item, and the focused item scrolls into view (docs/03 §5). On a page
 * without items (`ids` empty), ↑ ↓ scroll the content by 60% of its height instead.
 *
 * Each item is an element inside `root` with `data-focus-id={id}` and `tabIndex={-1}`; it gets
 * real DOM focus. The focus is remembered per history entry and restored by id on return.
 *
 * A screen spreads `keys` first and adds its own keys after them:
 * `useKeys({ ...list.keys, onHash: openAreas, onMenu: openMenu })`.
 */
export function useFocusList(ids: readonly string[], options: FocusListOptions): FocusList {
  const { root, onActivate, digitOffset = 0, active = true } = options
  const current = useRestoredFocus(ids, active)
  const { id, index } = current
  const first = id !== null && id === ids[0]

  // After every commit, so the focus survives re-rendered items and moved content.
  useLayoutEffect(() => {
    const list = root.current
    if (!active || id === null || !list) return
    const item = findItem(list, id)
    if (!item) return
    if (document.activeElement !== item) item.focus({ preventScroll: true })
    const container = scrollParent(list)
    if (container) keepInView(container, item, first)
  })

  const page = (direction: 1 | -1) => {
    const container = root.current && scrollParent(root.current)
    if (container) scrollPage(container, direction)
  }
  const move = (to: number) => {
    const target = ids[to]
    if (target !== undefined) current.focus(target)
  }
  const open = (target: string) => {
    current.focus(target)
    onActivate?.(target)
  }

  const keys: KeyHandlers =
    id === null
      ? { onUp: () => page(-1), onDown: () => page(1) }
      : {
          onUp: () => move(index - 1),
          onDown: () => move(index + 1),
          onEnter: () => open(id),
          onDigit: (digit) => {
            const target = digit > 0 ? ids[digit - 1 + digitOffset] : undefined
            if (target !== undefined) open(target)
          },
        }

  return { focusedId: id, keys, focus: current.focus }
}
