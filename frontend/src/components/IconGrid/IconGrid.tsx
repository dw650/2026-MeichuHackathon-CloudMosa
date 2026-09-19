import type { ReactNode } from 'react'

import { CropSvg } from '@/icons/crops'

import type { Tone } from '../categories'
import { KeyCap } from '../KeyCap/KeyCap'
import styles from './IconGrid.module.css'

export interface IconGridItem {
  focusId: string
  label: string
  /** Crop illustration id, e.g. a category's `icon` from the API. */
  icon: string
  tone: Tone
  /** Number key cap, drawn on both sizes: the cells sit where keys 1–9 are. */
  keyCap?: ReactNode
}

export interface IconGridProps {
  /** Up to nine cells, filled row by row like the keypad. */
  items: readonly IconGridItem[]
}

/** 3×3 grid of tinted cells with an illustration, a name and a key cap (docs/03 §4). */
export function IconGrid({ items }: IconGridProps) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <div
          key={item.focusId}
          className={styles.cell}
          data-tone={item.tone}
          data-focus-id={item.focusId}
          tabIndex={-1}
        >
          {item.keyCap != null && <KeyCap>{item.keyCap}</KeyCap>}
          <CropSvg id={item.icon} className={styles.icon} />
          <span className={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
