import type { TFunction } from 'i18next'

import type { MonthLabels } from '@/lib/monthly'

/**
 * Month words and layouts for `lib/monthly` in the language of `t`, e.g.
 * `formatMonth(item.month, today, monthLabels(useTranslation().t))` → `8 月` / `Aug`.
 */
export function monthLabels(t: TFunction): MonthLabels {
  return {
    names: t('date.months', { returnObjects: true }),
    withYear: (vars) => t('date.withYear', vars),
    day: (vars) => t('date.day', vars),
  }
}
