// Number and price formatting with Intl in the country's locale (docs/03 §7):
// en-IN groups in lakhs (1,23,450), zh-TW in thousands. Digits are always Latin (0–9).

import { toUnit, type UnitSpec } from './units'

/** Shown in place of a missing number; missing data is never shown as 0. */
export const MISSING = '—'
/** Minus sign of signed values (U+2212), wider and clearer than Intl's hyphen-minus. */
export const MINUS = '−'

/**
 * Intl option for 0–9 in every locale: some (mr-IN, a `-u-nu-deva` tag) default to their own
 * digits, and prices must read the same whatever the UI language.
 */
export const LATIN_DIGITS = { numberingSystem: 'latn' } as const

type Sign = -1 | 0 | 1

/** True for a real number; `null`, `undefined`, NaN and ±Infinity count as missing. */
export const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Formats `value` with exactly `decimals` fraction digits and returns the sign of the
 * rounded result apart from its unsigned digits. Intl rounds halves away from zero on the
 * shortest decimal form (0.15 → 0.2) and gives a zero result no sign, so −0.04 → 0.0.
 */
function splitSign(value: number, locale: string, decimals: number) {
  const formatter = new Intl.NumberFormat(locale, {
    ...LATIN_DIGITS,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'exceptZero',
  })
  let sign: Sign = 0
  let digits = ''
  for (const part of formatter.formatToParts(value)) {
    if (part.type === 'plusSign') sign = 1
    else if (part.type === 'minusSign') sign = -1
    else digits += part.value
  }
  return { sign, digits }
}

/** Sign of `value` once rounded to `decimals`, i.e. the sign its formatted text shows. */
export function roundedSign(value: number, decimals: number): Sign {
  return splitSign(value, 'en', decimals).sign
}

/** Formats a number with fixed decimals; missing or invalid values become `MISSING`. */
export function formatNumber(
  value: number | null | undefined,
  locale: string,
  decimals: number,
): string {
  if (!isFiniteNumber(value)) return MISSING
  const { sign, digits } = splitSign(value, locale, decimals)
  return sign < 0 ? MINUS + digits : digits
}

/** Like `formatNumber` but always signed: `+95`, `−95`, and `±0` when it rounds to zero. */
export function formatSignedNumber(
  value: number | null | undefined,
  locale: string,
  decimals: number,
): string {
  if (!isFiniteNumber(value)) return MISSING
  const { sign, digits } = splitSign(value, locale, decimals)
  return (sign > 0 ? '+' : sign < 0 ? MINUS : '±') + digits
}

/** Formats a per-kg price in `unit`, e.g. 23.5 → `2,350` per quintal. */
export function formatPrice(
  pricePerKg: number | null | undefined,
  unit: UnitSpec,
  locale: string,
): string {
  return formatNumber(toUnit(pricePerKg, unit), locale, unit.decimals)
}

/** Formats a per-kg price difference in `unit`, signed, e.g. 0.95 → `+95` per quintal. */
export function formatPriceDiff(
  diffPerKg: number | null | undefined,
  unit: UnitSpec,
  locale: string,
): string {
  return formatSignedNumber(toUnit(diffPerKg, unit), locale, unit.decimals)
}
