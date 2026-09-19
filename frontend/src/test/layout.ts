// jsdom has no layout engine. The focus hooks read the scroll container's visible height and
// each item's box, and scroll by setting `scrollTop`; these stubs provide all three.

/** An item's box in content coordinates: pixels from the top of the scrolled content. */
export interface Box {
  top: number
  height: number
}

const rect = (top: number, height: number): DOMRect => ({
  x: 0,
  y: top,
  top,
  bottom: top + height,
  left: 0,
  right: 0,
  width: 0,
  height,
  toJSON: () => ({}),
})

/**
 * Makes `container` a scroll area `height` pixels tall whose `scrollTop` starts at 0 and, like a
 * browser, never goes below 0. Each `[data-focus-id]` element inside it gets the box in `boxes`
 * under its id, moving up as the container scrolls down.
 */
export function stubLayout(container: HTMLElement, height: number, boxes: Record<string, Box>) {
  let scrollTop = 0
  Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => height })
  Object.defineProperty(container, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.max(0, value)
    },
  })
  container.getBoundingClientRect = () => rect(0, height)
  for (const item of Array.from(container.querySelectorAll<HTMLElement>('[data-focus-id]'))) {
    const box = boxes[item.dataset.focusId ?? '']
    if (box) item.getBoundingClientRect = () => rect(box.top - scrollTop, box.height)
  }
}

/** Boxes for a column of equal items, one per id: `height` tall, `gap` apart, from `top`. */
export function column(ids: readonly string[], top: number, height: number, gap: number) {
  return Object.fromEntries(ids.map((id, i) => [id, { top: top + i * (height + gap), height }]))
}
