import { UiIcon } from '@/icons/ui'
import type { UiIconName } from '@/icons/names'

import { cx } from '../cx'
import styles from './StatusBox.module.css'

export interface StatusBoxProps {
  /** Round icon above the title; not drawn on 128×160. */
  icon?: UiIconName
  title?: string
  /** Short lines shown on both sizes, e.g. "你的設定都還在". */
  lines?: readonly string[]
  /** Explanations shown on 240×320 only; 128×160 has no room for them (docs/03 §6). */
  details?: readonly string[]
}

/**
 * Centred message for loading, empty and error states (docs/03 §4). Any exit cards (retry,
 * other areas) follow it in a `CardList`.
 */
export function StatusBox({ icon, title, lines = [], details = [] }: StatusBoxProps) {
  return (
    <div className={styles.box} role="status">
      {icon && (
        <span className={styles.icon}>
          <UiIcon name={icon} />
        </span>
      )}
      {title && <span className={styles.title}>{title}</span>}
      {lines.map((line, i) => (
        <span key={`l${i}`} className={styles.line}>
          {line}
        </span>
      ))}
      {details.map((line, i) => (
        <span key={`d${i}`} className={cx(styles.line, styles.detail)}>
          {line}
        </span>
      ))}
    </div>
  )
}
