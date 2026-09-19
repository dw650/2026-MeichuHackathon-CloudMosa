import type { ReactNode } from 'react'

import type { Tone } from '../categories'
import { cx } from '../cx'
import { KeyCap } from '../KeyCap/KeyCap'
import styles from './Tile.module.css'

export interface TileProps {
  /** Colour family; without one the tile is slate grey (plain line icons). */
  tone?: Tone
  /** Key cap on the top-left corner, e.g. `1`–`9` on the first nine items. Not drawn on
   *  128×160, where the digit keys still work (docs/03 §6). */
  keyCap?: ReactNode
  /** A circle instead of a rounded square, e.g. for rank numbers. */
  round?: boolean
  /** The child is a colour illustration (drawn at 80%) rather than a line icon (62%). */
  art?: boolean
  /** A `UiIcon`, `CropSvg` or a short text such as a rank or a language glyph. */
  children: ReactNode
}

/**
 * The icon square at the start of a card (docs/03 §4). A parent can restyle every tile below it
 * with `--tile-bg` and `--tile-ink` (the error card does), and resize it with `--tile`.
 */
export function Tile({ tone, keyCap, round = false, art = false, children }: TileProps) {
  return (
    <span className={cx(styles.tile, round && styles.round, art && styles.art)} data-tone={tone}>
      {children}
      {keyCap != null && <KeyCap>{keyCap}</KeyCap>}
    </span>
  )
}
