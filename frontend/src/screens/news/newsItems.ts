// Focus ids and labels shared by the news list and the news detail (docs/02 §5.9).

import { type DateLabels, formatDate } from '@/lib/dates'
import type { Text } from '@/screens/shared/useText'

/** The retry exit of a failed load, and the connection-failed card above old items. */
export const RETRY_ID = 'action:retry'

const PREFIX = 'news:'

export const newsFocusId = (id: number) => PREFIX + String(id)

/** The news id of a card's focus id; `null` for other items. */
export function newsIdOf(focusId: string): number | null {
  if (!focusId.startsWith(PREFIX)) return null
  const id = Number(focusId.slice(PREFIX.length))
  return Number.isSafeInteger(id) ? id : null
}

/** Summary languages a locale file names; the news of a country is summarised in that
 *  country's own language, so any of them can reach a reader of any language. */
const SUMMARY_LANGS = ['zh-TW', 'en', 'ms', 'hi'] as const

/**
 * The line naming the language a summary is written in (「摘要為印地文」), or `null` when it is
 * the interface language and needs no saying. A screen shows it once, beside the summaries it
 * explains (docs/02 §5.9).
 */
export function summaryLangNote(
  summaryLang: string | null | undefined,
  uiLang: string,
  t: Text['t'],
): string | null {
  if (!summaryLang || summaryLang === uiLang) return null
  const known = SUMMARY_LANGS.find((lang) => lang === summaryLang)
  return known ? t(`news.summaryIn.${known}`) : null
}

/** 「今天」, 「昨天」, then the date (e.g. 「9/16 週三」); the backend counts the days. */
export function dayLabel(
  item: { days_ago: number; published_date: string },
  t: Text['t'],
  dates: DateLabels,
): string {
  if (item.days_ago <= 0) return t('news.today')
  if (item.days_ago === 1) return dates.yesterday
  return formatDate(item.published_date, dates)
}
