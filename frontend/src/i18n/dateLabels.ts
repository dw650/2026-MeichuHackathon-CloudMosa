import type { TFunction } from 'i18next'

import type { DateLabels } from '@/lib/dates'

/**
 * Date words and layouts for `lib/dates` in the language of `t`, e.g.
 * `formatDate(tradeDate, dateLabels(useTranslation().t))` → `9/19 週六` / `Sat 19/9`.
 */
export function dateLabels(t: TFunction): DateLabels {
  return {
    weekdays: t('date.weekdays', { returnObjects: true }),
    date: (vars) => t('date.short', vars),
    dateTime: (vars) => t('date.dataTime', vars),
    yesterday: t('freshness.yesterday'),
    daysAgo: (vars) => t('freshness.daysAgo', vars),
    none: t('freshness.none'),
  }
}
