import type { ReactNode } from 'react'

import { UiIcon } from '@/icons/ui'
import { MISSING } from '@/lib/format'

import { cx } from '../cx'
import { KeyCap } from '../KeyCap/KeyCap'
import { Pill, type PillProps } from '../Pill/Pill'
import { Skeleton } from '../Skeleton/Skeleton'
import styles from './Card.module.css'

export interface CardProps {
  /** Makes the card selectable: `data-focus-id` and `tabIndex={-1}` for the focus hooks. */
  focusId?: string
  /** Leading square: a `CropIcon`, a `Tile` with a line icon, or a round `Tile` with a rank. */
  lead?: ReactNode
  /** Bold name; long names get an ellipsis. */
  name: ReactNode
  /** Second line (variety, distance, freshness, reason for missing data); not shown on 128×160. */
  meta?: ReactNode
  /** The 7-day `Sparkline`; not shown on 128×160, nor when there is no price. */
  spark?: ReactNode
  /** Formatted price. `null` means no data: shows `—` (never 0), greys the card and drops the
   *  sparkline and the pill; pass the reason as `meta`. */
  price?: string | null
  /** Change (or `old`, `you`) under the price. On 128×160 a change keeps only its glyph. */
  pill?: Omit<PillProps, 'glyphOnlyWhenSmall'>
  /** Right-hand side of cards without a price: `Chevron`, `CheckBox`, a value or a status. */
  trailing?: ReactNode
  /** `mine`: the user's own area (soft brand background); `alert`: an error card. */
  variant?: 'mine' | 'alert'
  /** Shorter row for settings-like lists (36px; 20px on 128×160). */
  compact?: boolean
  /** Static bars instead of the meta and the price while the data loads. */
  loading?: boolean
}

/**
 * Harvest card (docs/03 §4): tile | name and meta | (sparkline) | price and pill. When focused
 * it gets a blue ring, a light blue background and a pointer in the left gutter. On 128×160 it
 * is a single line: icon, name, price and the change glyph (docs/03 §6).
 */
export function Card({
  focusId,
  lead,
  name,
  meta,
  spark,
  price,
  pill,
  trailing,
  variant,
  compact = false,
  loading = false,
}: CardProps) {
  const missing = price === null && !loading
  const showsData = !missing && !loading
  return (
    <div
      data-fixed=""
      className={cx(
        styles.card,
        variant && styles[variant],
        missing && styles.dim,
        compact && styles.compact,
      )}
      data-focus-id={focusId}
      tabIndex={focusId === undefined ? undefined : -1}
    >
      {lead != null && <span className={styles.lead}>{lead}</span>}
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        {loading ? (
          <span className={styles.meta}>
            <Skeleton width={50} />
          </span>
        ) : (
          meta != null && <span className={styles.meta}>{meta}</span>
        )}
      </span>
      {spark != null && showsData && <span className={styles.spark}>{spark}</span>}
      {(price !== undefined || loading) && (
        <span className={styles.end}>
          {loading ? (
            <Skeleton width={38} />
          ) : (
            <span className={styles.price}>{price ?? MISSING}</span>
          )}
          {pill && showsData && <Pill {...pill} glyphOnlyWhenSmall />}
        </span>
      )}
      {trailing != null && <span className={styles.trailing}>{trailing}</span>}
    </div>
  )
}

export interface CardListProps {
  children: ReactNode
}

/** A column of cards with the list gaps and gutters of docs/03 §3.3. */
export function CardList({ children }: CardListProps) {
  return <div className={styles.list}>{children}</div>
}

export interface ChevronProps {
  /** Adds the `OK` key cap, as on the "markets in this area" card; not drawn on 128×160. */
  okKey?: boolean
}

/** `›` (or `OK ›`) at the end of a card that opens something; turns blue with the focus. */
export function Chevron({ okKey = false }: ChevronProps) {
  return (
    <span className={styles.go}>
      {okKey && <KeyCap>OK</KeyCap>}
      <UiIcon name="chev" />
    </span>
  )
}

export interface CheckBoxProps {
  checked: boolean
}

/** Check box at the end of a card, e.g. crops in the watchlist editor. */
export function CheckBox({ checked }: CheckBoxProps) {
  return (
    <span className={cx(styles.check, checked && styles.checked)}>
      {checked && <UiIcon name="check" />}
    </span>
  )
}
