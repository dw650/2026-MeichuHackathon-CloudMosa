import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { dateLabels } from '@/i18n/dateLabels'
import { type LocalizedText, pickText } from '@/i18n/text'
import type { DateLabels } from '@/lib/dates'

export interface Text {
  t: ReturnType<typeof useTranslation>['t']
  /** The UI language actually shown: `zh-TW` or `en`. */
  lang: string
  /** Picks the right language out of an API name object. */
  pick(text: LocalizedText | null | undefined): string
  dates: DateLabels
}

export function useText(): Text {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language
  const dates = useMemo(() => dateLabels(t), [t])
  return { t, lang, pick: (text) => pickText(text, lang), dates }
}

/** Area name with the country's suffix, e.g. 「Nashik 縣」 / "Nashik district". */
export function areaLabel(
  area: { name: LocalizedText } | undefined,
  country: { area_suffix: LocalizedText } | undefined,
  lang: string,
): string {
  if (!area) return ''
  return pickText(area.name, lang) + pickText(country?.area_suffix, lang)
}
