// Restoring the focus by item id (docs/04 §4.4, docs/03 §5): every history entry remembers
// its focused item; coming back to it focuses that item again, wherever it now is in the list.

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { selectFocusId, useSession } from '@/store/session'

/** Where a list's focus is. */
export interface FocusState {
  /** `location.key` of the history entry this focus belongs to. */
  readonly key: string
  /** The focused item's `data-focus-id`; `null` while the list is empty. */
  readonly id: string | null
  /** Where `id` was last seen in the list, to stay in place if it disappears; -1 when empty. */
  readonly index: number
}

/**
 * The focus on arriving at history entry `key`: the `remembered` item if the list still has it
 * (found by id, not index), otherwise the first item.
 */
export function restoreFocus(
  ids: readonly string[],
  key: string,
  remembered: string | null,
): FocusState {
  const index = remembered === null ? -1 : ids.indexOf(remembered)
  if (index !== -1) return { key, id: remembered, index }
  const first = ids[0]
  return first === undefined ? { key, id: null, index: -1 } : { key, id: first, index: 0 }
}

/**
 * The focus after the list changed under it (data loaded, retail ⇄ wholesale): the same item
 * if it is still listed; if it disappeared, the item now in its place (the last one if the list
 * got shorter). A list that was empty restores the item remembered for the entry, looked up
 * only then. Returns `state` itself when nothing changes.
 */
export function followList(
  ids: readonly string[],
  state: FocusState,
  remembered: () => string | null,
): FocusState {
  if (state.id === null) {
    return ids.length === 0 ? state : restoreFocus(ids, state.key, remembered())
  }
  const index = ids.indexOf(state.id)
  if (index === state.index) return state
  if (index !== -1) return { ...state, index }
  const place = Math.min(state.index, ids.length - 1)
  const id = ids[place]
  return id === undefined ? { ...state, id: null, index: -1 } : { ...state, id, index: place }
}

/** The item remembered for history entry `key`, straight from the session store. */
const rememberedFor = (key: string): string | null => selectFocusId(key)(useSession.getState())

/** A list's focus as `useRestoredFocus` keeps it. */
export interface ListFocus {
  /** The focused item's id; `null` while the list is empty. */
  readonly id: string | null
  /** Its index in the list; -1 while the list is empty. */
  readonly index: number
  /** Focuses a listed item and remembers it for the history entry at once. */
  focus(id: string): void
}

/**
 * The focused item of `ids`, remembered per history entry (`location.key`) in the session store
 * and restored by id whenever the entry shows again, even while the screen stays mounted (another
 * entry of the same route, or a panel closing). A new entry starts on the first item.
 *
 * While `active` is false (a panel is open above the list), the focus stays with the entry it
 * belongs to: history changes are ignored and nothing is remembered.
 */
export function useRestoredFocus(ids: readonly string[], active: boolean): ListFocus {
  const { key } = useLocation()
  const [state, setState] = useState(() => restoreFocus(ids, key, rememberedFor(key)))
  const next =
    active && state.key !== key
      ? restoreFocus(ids, key, rememberedFor(key))
      : followList(ids, state, () => rememberedFor(state.key))
  // Adjusting state while rendering: React re-renders at once, before anything is committed.
  if (next !== state) setState(next)

  useEffect(() => {
    if (active && next.id !== null) useSession.getState().rememberFocus(next.key, next.id)
  }, [active, next.key, next.id])

  return {
    id: next.id,
    index: next.index,
    focus: (id) => {
      const index = ids.indexOf(id)
      if (index === -1 || id === next.id) return
      setState({ key: next.key, id, index })
      // Now, not in the effect: opening the item may leave the screen before effects run.
      useSession.getState().rememberFocus(next.key, id)
    },
  }
}
