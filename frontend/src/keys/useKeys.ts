import { useLayoutEffect, useRef } from 'react'

import { pushKeyScope, type KeyHandlers, type KeyLayer } from './keyScope'

export interface UseKeysOptions {
  /** `overlay` for panels (bottom sheets); screens keep the default `screen`. */
  layer?: KeyLayer
}

/**
 * Declares the key handlers of a screen or a panel while it is mounted (docs/04 §4.2).
 * Only the top scope receives keys, so call it once per screen and once per panel, merging
 * helper handlers (for example from focus hooks) into that one object.
 */
export function useKeys(handlers: KeyHandlers, { layer = 'screen' }: UseKeysOptions = {}): void {
  const latest = useRef(handlers)
  // New handlers every render: keep the latest without re-registering, which would reorder
  // the stack.
  useLayoutEffect(() => {
    latest.current = handlers
  })
  // A layout effect, so the stack matches the committed screen before the next key arrives.
  useLayoutEffect(() => pushKeyScope(() => latest.current, layer), [layer])
}
