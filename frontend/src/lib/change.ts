// Rise and fall (docs/06 §3.4). Only the direction is exposed: its colour depends on the
// country (India green-up, Taiwan red-up) and is chosen by components/rise.ts.

import { MINUS, MISSING, isFiniteNumber, roundedSign } from './format'
import { toUnit, type UnitSpec } from './units'

export type Direction = 'up' | 'down' | 'flat'

/** A change smaller than 0.05% counts as flat. */
export const FLAT_RATIO = 0.0005
/** From 10% the percentage is shown without decimals. */
const WHOLE_PERCENT_FROM = 0.1

/** A change is always shown with a glyph too, never by colour alone (docs/03 §3.1). */
export const DIRECTION_GLYPH: Readonly<Record<Direction, string>> = {
  up: '▲',
  down: '▼',
  flat: '＝',
}

const SIGN: Readonly<Record<Direction, string>> = { up: '+', down: MINUS, flat: '±' }

const fromSign = (sign: number): Direction => (sign > 0 ? 'up' : sign < 0 ? 'down' : 'flat')

/** Direction of a change ratio (0.042 = +4.2%); `null` when the ratio is missing. */
export function directionOf(ratio: number): Direction
export function directionOf(ratio: number | null | undefined): Direction | null
export function directionOf(ratio: number | null | undefined): Direction | null {
  if (ratio === null || ratio === undefined) return null
  return ratio >= FLAT_RATIO ? 'up' : ratio <= -FLAT_RATIO ? 'down' : 'flat'
}

/**
 * Size of a change ratio as a percentage, without sign: `0%` when flat, one decimal
 * under 10% (`4.2%`), whole numbers from 10% (`12%`). Pair it with `DIRECTION_GLYPH`.
 */
export function formatPercent(ratio: number | null | undefined, locale: string): string {
  if (!isFiniteNumber(ratio)) return MISSING
  const size = directionOf(ratio) === 'flat' ? 0 : Math.abs(ratio)
  const decimals = size > 0 && size < WHOLE_PERCENT_FROM ? 1 : 0
  // The percent style scales the decimal form by 100, so 0.145 rounds to 15%, not 14%.
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(size)
}

/** `formatPercent` with a sign for text without a glyph: `+3.1%`, `−3.1%`, `±0%`. */
export function formatSignedPercent(ratio: number | null | undefined, locale: string): string {
  if (!isFiniteNumber(ratio)) return MISSING
  return SIGN[directionOf(ratio)] + formatPercent(ratio, locale)
}

/**
 * Direction of a per-kg price difference as shown in `unit`: it is rounded to the unit's
 * decimals first, so it always agrees with the sign that `formatPriceDiff` prints.
 */
export function priceDiffDirection(diffPerKg: number, unit: UnitSpec): Direction
export function priceDiffDirection(
  diffPerKg: number | null | undefined,
  unit: UnitSpec,
): Direction | null
export function priceDiffDirection(
  diffPerKg: number | null | undefined,
  unit: UnitSpec,
): Direction | null {
  if (diffPerKg === null || diffPerKg === undefined) return null
  return fromSign(roundedSign(toUnit(diffPerKg, unit), unit.decimals))
}
