// Display currency (F19, docs/02 §5.7). The API always sends a price per kg in the country's
// own currency; the user can ask to see every price in one currency instead, so two countries
// can be read side by side. The conversion is display only — nothing is stored, sent or
// compared converted — and it lives here alone, so no screen can convert a price twice.
//
// A price moves between currencies through the US dollar rates of `GET /countries`:
//   price_in_B = price_in_A / per_usd_A * per_usd_B
// Without a rate for either side the local currency is kept and the screen says why; a rate
// is never guessed and a missing price stays missing (CLAUDE.md).

import { type Direction, priceDiffDirection } from './change'
import { formatNumber, formatSignedNumber, isFiniteNumber, roundedSign } from './format'
import { toUnit, type UnitSpec } from './units'

/** `local` keeps every country's own currency (the default); the rest convert every price. */
export const DISPLAY_CURRENCIES = ['local', 'TWD', 'MYR', 'INR', 'USD'] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]
/** A real currency the user can pick, i.e. every display currency but `local`. */
export type CurrencyCode = Exclude<DisplayCurrency, 'local'>

export const LOCAL: DisplayCurrency = 'local'
export const USD = 'USD'

/** One row of the `fx` list of `GET /countries`: units of the currency for one US dollar. */
export interface FxRate {
  readonly currency: string
  readonly per_usd: number
  readonly rate_date: string
}

/** Symbol in front of a converted price; the code itself when we have no symbol for it. */
const SYMBOLS: Readonly<Record<string, string>> = {
  TWD: 'NT$',
  MYR: 'RM',
  INR: '₹',
  USD: 'US$',
}

/** Fraction digits of a converted price, as the countries' own per-kg units declare them. */
const DECIMALS: Readonly<Record<string, number>> = { TWD: 0, INR: 0, MYR: 2, USD: 2 }
const DEFAULT_DECIMALS = 2
/** Digits a converted price keeps before the decimals are cut, so a real price is never 0. */
const SIGNIFICANT = 2
const MAX_DECIMALS = 4

/** `NT$`, `RM`, `₹`, `US$`; an unknown currency is written as its code. */
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency
}

/**
 * Fraction digits for `value` in `currency`: the currency's own (NT$ and ₹ whole, RM and
 * US$ with cents), and more when the number is small, so a price that really is 0.31 never
 * reads as 0. Values of 10 and up always use the currency's digits.
 */
export function priceDecimals(value: number | null | undefined, currency: string): number {
  const base = DECIMALS[currency] ?? DEFAULT_DECIMALS
  if (!isFiniteNumber(value) || value === 0) return base
  const size = Math.floor(Math.log10(Math.abs(value))) + 1 // digits before the point
  return Math.min(MAX_DECIMALS, Math.max(base, SIGNIFICANT - size))
}

/** How the prices of one country are shown: as they are, or converted into one currency. */
export interface Conversion {
  /** True when prices are shown in another currency than the country's own. */
  readonly converted: boolean
  /** The currency the prices are shown in (the country's own when not converted). */
  readonly currency: string
  readonly symbol: string
  /** Multiplier from a local price to the shown one; 1 when not converted. */
  readonly factor: number
  /** Day of the rates used, the older of the two; `null` when not converted. */
  readonly rateDate: string | null
  /** Rate of the shown currency, for 「1 美元＝31.83 TWD」; `null` when not converted. */
  readonly perUsd: number | null
  /** Why a currency was asked for and not used: no rate for one of the two sides. */
  readonly reason: 'no_rate' | null
}

const asIs = (currency: string, reason: Conversion['reason'] = null): Conversion => ({
  converted: false,
  currency,
  symbol: currencySymbol(currency),
  factor: 1,
  rateDate: null,
  perUsd: null,
  reason,
})

/** The rate of `currency`: one US dollar is one US dollar, whatever the list holds. */
function rateOf(currency: string, rates: readonly FxRate[]): FxRate | undefined {
  const row = rates.find((rate) => rate.currency === currency)
  if (row && Number.isFinite(row.per_usd) && row.per_usd > 0) return row
  return currency === USD
    ? { currency: USD, per_usd: 1, rate_date: row?.rate_date ?? '' }
    : undefined
}

/** The older of the two rate days, i.e. the day the conversion is only as fresh as. */
function olderDay(a: string, b: string): string | null {
  const days = [a, b].filter(Boolean)
  return days.length ? days.reduce((older, day) => (day < older ? day : older)) : null
}

/**
 * How to show the prices of a country whose currency is `local` when the user asked for
 * `wanted` (docs/02 §5.7). The local currency is kept — with a reason — when it is what was
 * asked for, when the country is not known yet, or when a rate is missing.
 */
export function conversion(
  local: string | null | undefined,
  wanted: DisplayCurrency,
  rates: readonly FxRate[],
): Conversion {
  if (!local) return asIs('')
  if (wanted === LOCAL || wanted === local) return asIs(local)
  const from = rateOf(local, rates)
  const to = rateOf(wanted, rates)
  if (!from || !to) return asIs(local, 'no_rate')
  return {
    converted: true,
    currency: wanted,
    symbol: currencySymbol(wanted),
    factor: to.per_usd / from.per_usd,
    rateDate: olderDay(from.rate_date, to.rate_date),
    perUsd: to.per_usd,
    reason: null,
  }
}

/** Prices as they come from the API: the country's own currency, whatever the setting. */
export const NO_CONVERSION: Conversion = asIs('')

/** A per-kg price in `unit` and in the shown currency; a missing price stays missing. */
export function toMoney(
  perKg: number | null | undefined,
  unit: UnitSpec,
  fx: Conversion,
): number | null {
  const value = toUnit(perKg, unit)
  return value === null ? null : value * fx.factor
}

/** Digits of a price in `unit`: the unit's own, or the currency's once converted. */
const decimalsOf = (value: number | null, unit: UnitSpec, fx: Conversion): number =>
  fx.converted ? priceDecimals(value, fx.currency) : unit.decimals

/** A per-kg price in `unit`, converted when the user picked another currency; `—` if absent. */
export function formatMoney(
  perKg: number | null | undefined,
  unit: UnitSpec,
  locale: string,
  fx: Conversion,
): string {
  const value = toMoney(perKg, unit, fx)
  return formatNumber(value, locale, decimalsOf(value, unit, fx))
}

/** The same for a difference, always signed: `+95`, `−3.2`, `±0`. */
export function formatMoneyDiff(
  diffPerKg: number | null | undefined,
  unit: UnitSpec,
  locale: string,
  fx: Conversion,
): string {
  const value = toMoney(diffPerKg, unit, fx)
  return formatSignedNumber(value, locale, decimalsOf(value, unit, fx))
}

/** Direction of a difference as it is shown, so glyph and number always agree. */
export function moneyDiffDirection(
  diffPerKg: number | null | undefined,
  unit: UnitSpec,
  fx: Conversion,
): Direction | null {
  if (!fx.converted) return priceDiffDirection(diffPerKg, unit)
  const value = toMoney(diffPerKg, unit, fx)
  if (value === null) return null
  const sign = roundedSign(value, decimalsOf(value, unit, fx))
  return sign > 0 ? 'up' : sign < 0 ? 'down' : 'flat'
}
