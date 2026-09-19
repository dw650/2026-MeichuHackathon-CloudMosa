import type { UiIconName } from '@/icons/names'
import { UiIcon } from '@/icons/ui'

import { KeyCap } from '../KeyCap/KeyCap'
import styles from './Sheet.module.css'

export interface SheetItem {
  /** Focus id of the row, e.g. `sort:priceAsc`. */
  focusId: string
  label: string
  /** Line icon before the label; not drawn on 128×160 (docs/03 §6). */
  icon?: UiIconName
  /** The option now in use, which gets a check mark. */
  current?: boolean
}

export interface SheetProps {
  /** Title over the rows; on 128×160 it only names the dialog. */
  title: string
  items: readonly SheetItem[]
}

/**
 * Bottom sheet over a scrim (docs/03 §4): grab bar, title, then one row per option with a
 * number key cap (1–9), an icon, the label and a check for the current option. Pass it as the
 * `overlay` of `Shell`; it fills that layer. Opening, closing and keys belong to the screen.
 */
export function Sheet({ title, items }: SheetProps) {
  return (
    <div className={styles.scrim}>
      <div className={styles.sheet} role="dialog" aria-label={title}>
        <div className={styles.grab} />
        <div className={styles.title}>{title}</div>
        {items.map((item, i) => (
          <div
            data-fixed=""
            key={item.focusId}
            className={styles.row}
            data-focus-id={item.focusId}
            tabIndex={-1}
            aria-current={item.current ? true : undefined}
          >
            <span className={styles.key}>{i < 9 && <KeyCap>{i + 1}</KeyCap>}</span>
            <span className={styles.icon}>{item.icon && <UiIcon name={item.icon} />}</span>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.check}>{item.current && <UiIcon name="check" />}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
