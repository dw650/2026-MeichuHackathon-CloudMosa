// Trade dates, data times and freshness labels (docs/03 §7, docs/06 §3.5).
// The backend works out each country's local dates; the frontend never reads the browser
// time zone (CloudMosa only offers Etc/GMT±N, docs/08 §9) and never decides "today" itself.

import { MISSING } from './format'

/** A calendar date as sent by the API (`YYYY-MM-DD`). */
export interface LocalDate {
  readonly year: number
  /** 1–12. */
  readonly month: number
  readonly day: number
  /** 0 = Sunday … 6 = Saturday. */
  readonly weekday: number
}

/** A timestamp's date and wall-clock time as written, in the country's own offset. */
export interface LocalDateTime extends LocalDate {
  readonly hour: number
  readonly minute: number
}

/** Words and layouts for dates; T17 builds them from the i18n strings (STR in the mockup). */
export interface DateLabels {
  /** Weekday names, Sunday first (STR `wd`). */
  readonly weekdays: readonly string[]
  /**
   * Weekday initials for the 7-day chart axis, Sunday first (`六`, `Sa`, `शु`): whole from the
   * locale, because cutting a name would drop a vowel sign (शनि → शन).
   */
  readonly weekdayInitials: readonly string[]
  /** Short date, e.g. zh `9/19 週六`, en `Sat 19/9` (STR `date`). */
  readonly date: (vars: { m: number; d: number; w: string }) => string
  /** Data time, e.g. `9/19 11:40`; `time` is already `HH:mm`. */
  readonly dateTime: (vars: { m: number; d: number; time: string }) => string
  /** Data from the day before (STR `yday`). */
  readonly yesterday: string
  /** Data from `n` days ago (STR `daysAgo`). */
  readonly daysAgo: (vars: { n: number }) => string
  /** No price in the last 30 days (STR `none`). */
  readonly none: string
}

/** Freshness computed by the backend (API `staleness`). */
export type StalenessState = 'today' | 'closed' | 'stale' | 'none'

export interface Staleness {
  /** Days between the latest trade date and today; `null` when there is no data. */
  readonly days: number | null
  readonly state: StalenessState
}

export interface Freshness {
  /** Label next to the data; empty for today's data, which needs none. */
  readonly text: string
  /** Show the label in the warning style. */
  readonly warn: boolean
}

/** Stale data this many days old or older gets the warning style. */
export const STALE_WARN_DAYS = 3

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/

function toLocalDate(year: number, month: number, day: number): LocalDate | null {
  // Only UTC methods, so the result is the same in every time zone.
  const utc = new Date(Date.UTC(year, month - 1, day))
  const valid =
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  return valid ? { year, month, day, weekday: utc.getUTCDay() } : null
}

/** Reads a `YYYY-MM-DD` date; `null` for anything else, including impossible dates. */
export function parseLocalDate(value: string | null | undefined): LocalDate | null {
  const match = value ? DATE.exec(value) : null
  if (!match) return null
  const [, year, month, day] = match
  return toLocalDate(Number(year), Number(month), Number(day))
}

/**
 * Reads an ISO 8601 timestamp such as `2026-09-19T11:40:00+05:30`. The offset is not
 * applied: the time is already the country's local time and is kept as written.
 */
export function parseLocalDateTime(value: string | null | undefined): LocalDateTime | null {
  const match = value ? DATE_TIME.exec(value) : null
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const date = toLocalDate(Number(year), Number(month), Number(day))
  return date && { ...date, hour: Number(hour), minute: Number(minute) }
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const clock = (at: LocalDateTime) => `${pad2(at.hour)}:${pad2(at.minute)}`

/** Formats a trade date, e.g. zh `9/19 週六`, en `Sat 19/9`; `MISSING` if invalid. */
export function formatDate(value: string | null | undefined, labels: DateLabels): string {
  const date = parseLocalDate(value)
  if (!date) return MISSING
  return labels.date({ m: date.month, d: date.day, w: labels.weekdays[date.weekday] ?? '' })
}

/** Wall-clock time of a timestamp as `HH:mm`, e.g. `11:40`; `MISSING` if invalid. */
export function formatTime(value: string | null | undefined): string {
  const at = parseLocalDateTime(value)
  return at ? clock(at) : MISSING
}

/** Formats a data time, e.g. `9/19 11:40`; `MISSING` if invalid. */
export function formatDateTime(value: string | null | undefined, labels: DateLabels): string {
  const at = parseLocalDateTime(value)
  return at ? labels.dateTime({ m: at.month, d: at.day, time: clock(at) }) : MISSING
}

/** Relative age of data: '' for today, then `昨天` / `Yesterday`, then `3 天前` / `3d ago`. */
export function formatDaysAgo(days: number, labels: DateLabels): string {
  if (days <= 0) return ''
  return days === 1 ? labels.yesterday : labels.daysAgo({ n: days })
}

/**
 * Label and style for data of a given freshness (docs/06 §3.5): nothing for today; the
 * trade date after market holidays only; `昨天` / `N 天前` for stale data, in the warning
 * style from `STALE_WARN_DAYS`; `無資料` when there is no data.
 */
export function describeFreshness(
  staleness: Staleness,
  tradeDate: string | null | undefined,
  labels: DateLabels,
): Freshness {
  const { state } = staleness
  if (state === 'today') return { text: '', warn: false }
  if (state === 'closed') return { text: formatDate(tradeDate, labels), warn: false }
  if (state === 'none') return { text: labels.none, warn: false }
  const days = staleness.days ?? 0
  return { text: formatDaysAgo(days, labels), warn: days >= STALE_WARN_DAYS }
}
