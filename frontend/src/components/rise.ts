// Rise and fall colours follow the country (docs/03 §3.1): India shows rising prices green and
// Taiwan red. The app root provides the country's rule (API `up_is_pos`); components turn a
// direction into the colour to draw. The ▲▼＝ glyph never depends on it.

import { createContext, useContext } from 'react'

import type { Direction } from '@/lib/change'

/** Colour of a direction: `pos` green, `neg` red, `flat` grey (tokens `--pos`, `--neg`, `--flat`). */
export type RiseColor = 'pos' | 'neg' | 'flat'

/**
 * The current country's rule: `true` when rising prices are green. The app root renders
 * `<UpIsPosContext value={country.up_is_pos}>`; without it, components use India's colours.
 */
export const UpIsPosContext = createContext(true)

export function riseColor(direction: Direction, upIsPos: boolean): RiseColor {
  if (direction === 'flat') return 'flat'
  return (direction === 'up') === upIsPos ? 'pos' : 'neg'
}

/** `riseColor` for the country in `UpIsPosContext`. */
export function useRiseColor(direction: Direction): RiseColor {
  return riseColor(direction, useContext(UpIsPosContext))
}
