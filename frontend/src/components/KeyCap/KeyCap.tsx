import type { ReactNode } from 'react'

import styles from './KeyCap.module.css'

export interface KeyCapProps {
  /** The key: `1`–`9`, `0`, `*`, `#`, `OK`. */
  children: ReactNode
}

/**
 * A key drawn like the phone's physical key (docs/03 §4), placed next to what it controls.
 * Rendered as `<kbd>`: its 9px text is the one exception to the font floor (docs/03 §3.2).
 */
export function KeyCap({ children }: KeyCapProps) {
  return <kbd className={styles.key}>{children}</kbd>
}
