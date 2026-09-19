// Monthly prices (bonus B5, docs/06 §1.3): World Bank monthly averages, published early in the
// next month. A month is never "today", so every price shows its month; a month far behind the
// country's today (sent by the API, never read from the browser) gets the warning style.

import { parseLocalDate } from './dates'
import { isFiniteNumber, MISSING } from './format'

/** A calendar month. */
export interface Month {
  readonly year: number
  /** 1–12. */
  readonly month: number
}

/** Month words from i18n. */
export interface MonthLabels {
  /** Month names, January first: zh `1 月`, en `Jan`. */
  readonly names: readonly string[]
  /** A month with its year, e.g. zh `2025 年 12 月`, en `Dec 2025`; `month` is its name. */
  readonly withYear: (vars: { month: string; y: number }) => string
  /** A day without its weekday, e.g. zh `9/19`, en `19/9` (rate and update dates). */
  readonly day: (vars: { m: number; d: number }) => string
}

export interface MonthText {
  readonly text: string
  /** Older than the usual publication delay: show it in the warning style. */
  readonly warn: boolean
}

/** Months behind the current one from which a month is flagged (August is normal in
 *  September, and July until the August figures come out early in the month). */
export const STALE_MONTHS = 3

const MONTH = /^(\d{4})-(\d{2})(?:-\d{2})?$/

/** Reads `2026-08-01` (or `2026-08`); `null` for anything else. */
export function parseMonth(value: string | null | undefined): Month | null {
  const match = value ? MONTH.exec(value) : null
  if (!match) return null
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null
}

/** Whole months from `from` to `to` (positive when `to` is later). */
export function monthsBetween(from: Month, to: Month): number {
  return (to.year - from.year) * 12 + (to.month - from.month)
}

/** The month's name alone (`8 月`, `Aug`); `MISSING` if invalid. */
export function monthName(value: string | null | undefined, labels: MonthLabels): string {
  const month = parseMonth(value)
  return month ? (labels.names[month.month - 1] ?? MISSING) : MISSING
}

/**
 * A month as a list shows it: the name alone in today's year (`8 月`), else with its year
 * (`2025 年 12 月`); `withYear` always adds it. `MISSING` if the month is invalid.
 */
export function formatMonth(
  value: string | null | undefined,
  today: string | null | undefined,
  labels: MonthLabels,
  options: { withYear?: boolean } = {},
): string {
  const month = parseMonth(value)
  if (!month) return MISSING
  const name = labels.names[month.month - 1] ?? MISSING
  const current = parseMonth(today)
  if (!options.withYear && current?.year === month.year) return name
  return labels.withYear({ month: name, y: month.year })
}

/** `formatMonth` plus the warning style for months `STALE_MONTHS` or more behind today. */
export function describeMonth(
  value: string | null | undefined,
  today: string | null | undefined,
  labels: MonthLabels,
  options: { withYear?: boolean } = {},
): MonthText {
  const month = parseMonth(value)
  const current = parseMonth(today)
  const warn = !!month && !!current && monthsBetween(month, current) >= STALE_MONTHS
  return { text: formatMonth(value, today, labels, options), warn }
}

/** A date as `9/19` (zh) or `19/9` (en); `MISSING` if invalid. */
export function formatDay(value: string | null | undefined, labels: MonthLabels): string {
  const date = parseLocalDate(value)
  return date ? labels.day({ m: date.month, d: date.day }) : MISSING
}

/** A published US dollar price as written, up to two decimals: `471`, `233.8`, `0.38`. */
export function formatUsd(value: number | null | undefined, locale: string): string {
  if (!isFiniteNumber(value)) return MISSING
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}
