// DOM helpers for the focus hooks: find items, and scroll their container by the rules of
// docs/03 §5. Scrolling sets `scrollTop` directly, so it is instant (never smooth).

/** Gap kept between the focused item and the edges of the visible area, in px. */
export const SCROLL_MARGIN = 6
/** Share of the visible height that ↑ ↓ scroll on a page without selectable items. */
export const PAGE_SCROLL = 0.6

/** The item inside `root` whose `data-focus-id` is `id`, or `null`. */
export function findItem(root: HTMLElement, id: string): HTMLElement | null {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-focus-id]'))
  return items.find((item) => item.dataset.focusId === id) ?? null
}

/** `el` itself or its nearest ancestor that scrolls vertically (`overflow-y: auto | scroll`). */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

/**
 * Scrolls `container` as little as possible so that `item` shows with `SCROLL_MARGIN` around it.
 * When `item` is the first one and fits, scrolls to the very top instead, so whatever sits above
 * the list (info bar, tabs) shows too.
 */
export function keepInView(container: HTMLElement, item: HTMLElement, first: boolean): void {
  const view = container.clientHeight
  const scrolled = container.scrollTop
  const box = item.getBoundingClientRect()
  // Position inside the scrolled content, whatever elements sit in between.
  const top = box.top - container.getBoundingClientRect().top - container.clientTop + scrolled
  const bottom = top + box.height
  if (first && bottom <= view) container.scrollTop = 0
  else if (top - SCROLL_MARGIN < scrolled) container.scrollTop = top - SCROLL_MARGIN
  else if (bottom + SCROLL_MARGIN > scrolled + view) {
    container.scrollTop = bottom + SCROLL_MARGIN - view
  }
}

/** Scrolls `container` by `PAGE_SCROLL` of its visible height; `direction` 1 is down. */
export function scrollPage(container: HTMLElement, direction: 1 | -1): void {
  container.scrollTop += direction * Math.round(container.clientHeight * PAGE_SCROLL)
}
