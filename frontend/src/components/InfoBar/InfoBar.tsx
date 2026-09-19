import type { ReactNode } from 'react'

import { cx } from '../cx'
import styles from './InfoBar.module.css'

export interface InfoBarProps {
  /** Main information, always shown: the area (pin icon, `<b>` name, `#` key cap on the page
   *  where `#` changes the area), or the `*` key cap, price type tag and unit. */
  left: ReactNode
  /** Secondary information (price type, unit, date or data time); not shown on 128×160. */
  right?: ReactNode
}

/**
 * The context row under the header (docs/03 §4). Inside a cell, `UiIcon`s take the brand
 * colour and `<b>` marks the name that gets an ellipsis when long. On 128×160 only the left
 * cell stays and key caps are not drawn (docs/03 §6); the keys keep working.
 */
export function InfoBar({ left, right }: InfoBarProps) {
  return (
    <div className={styles.bar} data-fixed="">
      <span className={styles.cell}>{left}</span>
      {right != null && <span className={cx(styles.cell, styles.right)}>{right}</span>}
    </div>
  )
}
