import { useContext } from 'react'

import { DIRECTION_GLYPH, type Direction } from '@/lib/change'

import { cx } from '../cx'
import { riseColor, UpIsPosContext } from '../rise'
import styles from './Pill.module.css'

/** A change (`up`, `down`, `flat`), old data (`old`, 舊) or the user's own area (`you`, 你). */
export type PillKind = Direction | 'old' | 'you'

export interface PillProps {
  kind: PillKind
  /** Text after the glyph, already formatted: `4.2%`, `+95`, `舊`, `你`. */
  text?: string
  /** On 128×160 keep only the ▲▼＝ glyph (lists, docs/03 §6); `old` and `you` keep their text. */
  glyphOnlyWhenSmall?: boolean
}

const isDirection = (kind: PillKind): kind is Direction =>
  kind === 'up' || kind === 'down' || kind === 'flat'

/**
 * Rounded tag (docs/03 §4). A change always carries its ▲▼＝ glyph, never colour alone; its
 * colour follows the country in `UpIsPosContext`.
 */
export function Pill({ kind, text, glyphOnlyWhenSmall = false }: PillProps) {
  const upIsPos = useContext(UpIsPosContext)
  const direction = isDirection(kind) ? kind : null
  const color = direction ? riseColor(direction, upIsPos) : kind
  return (
    <span
      className={cx(
        styles.pill,
        styles[color],
        direction && glyphOnlyWhenSmall && styles.glyphOnly,
      )}
    >
      {direction && <span>{DIRECTION_GLYPH[direction]}</span>}
      {text && <span className={styles.text}>{text}</span>}
    </span>
  )
}
