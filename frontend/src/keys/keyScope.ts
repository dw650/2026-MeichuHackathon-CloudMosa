/**
 * The app's single keydown dispatcher and its key-scope stack (docs/04 §4.2).
 * Screens sit at the bottom, open panels above them; only the top scope receives keys.
 */

/** What a scope reacts to; every handler is optional. Key meanings: docs/02 §4. */
export interface KeyHandlers {
  onUp?: () => void
  onDown?: () => void
  onLeft?: () => void
  onRight?: () => void
  /** OK (the centre key). */
  onEnter?: () => void
  /** Left soft key, which the platform reports as `Escape`: opens the bottom menu. */
  onMenu?: () => void
  onStar?: () => void
  onHash?: () => void
  /** Digit keys `'0'`–`'9'`, passed as a number. */
  onDigit?: (digit: number) => void
}

/** Stacking layers, lowest first. Panels use `overlay`, so they stay above screens whatever
 *  order React runs effects in (a child's effects run before its parent's). */
const LAYERS = ['screen', 'overlay'] as const
export type KeyLayer = (typeof LAYERS)[number]

type SingleKeyHandler = Exclude<keyof KeyHandlers, 'onDigit'>

// Only event.key tells '#' from '3' (docs/08 §3); code and keyCode are never read.
const HANDLER_BY_KEY = new Map<string, SingleKeyHandler>([
  ['ArrowUp', 'onUp'],
  ['ArrowDown', 'onDown'],
  ['ArrowLeft', 'onLeft'],
  ['ArrowRight', 'onRight'],
  ['Enter', 'onEnter'],
  ['Escape', 'onMenu'],
  ['*', 'onStar'],
  ['#', 'onHash'],
])
const DIGIT = /^[0-9]$/
// Holding a key repeats only for the arrows (docs/02 §4).
const REPEATING_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

interface Scope {
  readonly layer: number
  readonly getHandlers: () => KeyHandlers
}

/** In registration order; the listener is attached only while this is not empty. */
const scopes: Scope[] = []

/** The newest scope in the highest layer. */
function topScope(): Scope {
  return scopes.reduce((top, scope) => (scope.layer >= top.layer ? scope : top))
}

function handlerFor(handlers: KeyHandlers, key: string): (() => void) | undefined {
  const name = HANDLER_BY_KEY.get(key)
  if (name) return handlers[name]
  const { onDigit } = handlers
  return onDigit && DIGIT.test(key) ? () => onDigit(Number(key)) : undefined
}

function onKeyDown(event: KeyboardEvent): void {
  // Desktop shortcuts and input-method composition are not ours.
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  // OK is handled on keydown only; stop a focused button from clicking as well.
  if (event.key === 'Enter') event.preventDefault()
  const handler = handlerFor(topScope().getHandlers(), event.key)
  if (!handler) return
  // A key the top scope handles never scrolls the page, even when a repeat is swallowed.
  event.preventDefault()
  if (event.repeat && !REPEATING_KEYS.has(event.key)) return
  handler()
}

/**
 * Adds a key scope and returns a function that removes it (calling it twice is harmless).
 * The newest scope in the highest layer receives every key; nothing falls through to scopes
 * below it, not even keys it has no handler for. `getHandlers` is called for each key, so it
 * can return the latest handlers. The one window keydown listener exists while any scope does.
 */
export function pushKeyScope(
  getHandlers: () => KeyHandlers,
  layer: KeyLayer = 'screen',
): () => void {
  const scope: Scope = { layer: LAYERS.indexOf(layer), getHandlers }
  scopes.push(scope)
  if (scopes.length === 1) window.addEventListener('keydown', onKeyDown)
  return () => {
    const index = scopes.indexOf(scope)
    if (index === -1) return
    scopes.splice(index, 1)
    if (scopes.length === 0) window.removeEventListener('keydown', onKeyDown)
  }
}
