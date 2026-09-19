import { useFocusList, type FocusList, type FocusListOptions } from './useFocusList'

export interface GridOptions extends FocusListOptions {
  /** ◀ on the left column; the home screen goes back to the 關注 tab (docs/02 §4). */
  onLeftEdge?: () => void
}

/**
 * Focus for a grid of `cols` columns filled row by row, such as the home screen's 3×3 category
 * grid (docs/02 §4): ↑ ↓ jump a whole row, ◀ ▶ move within the row, ◀ on the left column calls
 * `onLeftEdge`; where no cell is (past the top, bottom or right end) the focus stays. OK, digits,
 * scrolling and restoring work as in `useFocusList`, whose `keys` are merged the same way.
 */
export function useGrid(ids: readonly string[], cols: number, options: GridOptions): FocusList {
  const { onLeftEdge, ...listOptions } = options
  const list = useFocusList(ids, listOptions)
  const index = list.focusedId === null ? -1 : ids.indexOf(list.focusedId)
  if (index === -1) return list

  const go = (to: number) => {
    const target = ids[to]
    if (target !== undefined) list.focus(target)
  }
  const column = index % cols
  return {
    ...list,
    keys: {
      ...list.keys,
      onUp: () => go(index - cols),
      onDown: () => go(index + cols),
      onLeft: () => (column === 0 ? onLeftEdge?.() : go(index - 1)),
      onRight: () => {
        if (column < cols - 1) go(index + 1)
      },
    },
  }
}
