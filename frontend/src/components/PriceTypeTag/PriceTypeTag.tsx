import type { PriceType } from '@/lib/units'

import { cx } from '../cx'
import styles from './PriceTypeTag.module.css'

export interface PriceTypeTagProps {
  type: PriceType
  /** `批發` / `Wholesale` or `零售` / `Retail`. */
  label: string
}

/** Wholesale (green) or retail (purple) label in white text (docs/03 §4). */
export function PriceTypeTag({ type, label }: PriceTypeTagProps) {
  return <span className={cx(styles.tag, styles[type])}>{label}</span>
}
