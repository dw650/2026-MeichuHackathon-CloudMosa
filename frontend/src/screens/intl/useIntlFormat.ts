import { useMemo } from 'react'

import type { Country } from '@/api/queries'
import { monthLabels } from '@/i18n'
import { formatPercent, formatSignedPercent } from '@/lib/change'
import { formatNumber, formatPrice, formatPriceDiff } from '@/lib/format'
import { formatUsd, type MonthLabels } from '@/lib/monthly'
import type { UnitSpec } from '@/lib/units'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useText } from '@/screens/shared/useText'

type UnitOption = Country['units']['wholesale']['options'][number]

const KG: UnitSpec = { id: 'kg', perKg: 1, decimals: 1 }
/** Decimals of an exchange rate as shown: `31.83`, `4.08`, `157.06`. */
const RATE_DECIMALS = 2

/**
 * The country's per-kg unit (wholesale options first, then retail), whatever the unit the
 * user picked for daily prices: the international page always shows local currency per kg.
 */
export function kgOptionOf(country: Country | undefined): UnitOption | undefined {
  if (!country) return undefined
  for (const type of ['wholesale', 'retail'] as const) {
    const option = country.units[type].options.find((o) => o.per_kg === 1)
    if (option) return option
  }
  return undefined
}

export interface IntlFormat {
  locale: string
  /** e.g. 元/公斤, ₹/kg; the currency code per kg for a country without a kg unit. */
  unitLabel: string
  months: MonthLabels
  price(perKg: number | null | undefined): string
  diff(perKg: number | null | undefined): string
  percent(ratio: number | null | undefined): string
  signedPercent(ratio: number | null | undefined): string
  /** The published price with its unit: 471 美元/公噸, US$0.38/kg. */
  usd(value: number | null | undefined, unit: 'mt' | 'kg'): string
  /** 1 美元＝31.83 TWD. */
  rate(perUsd: number, currency: string): string
}

/** Formatters of the international prices in the chosen country's currency and locale. */
export function useIntlFormat(): IntlFormat {
  const { t, pick } = useText()
  const { country } = useCountryData()
  const months = useMemo(() => monthLabels(t), [t])
  const option = kgOptionOf(country)
  const unit: UnitSpec = option ? { id: option.id, perKg: 1, decimals: option.decimals } : KG
  const locale = country?.locale ?? 'en-IN'
  return {
    locale,
    unitLabel: option ? pick(option.label) : t('intl.perKg', { currency: country?.currency ?? '' }),
    months,
    price: (perKg) => formatPrice(perKg, unit, locale),
    diff: (perKg) => formatPriceDiff(perKg, unit, locale),
    percent: (ratio) => formatPercent(ratio, locale),
    signedPercent: (ratio) => formatSignedPercent(ratio, locale),
    usd: (value, per) =>
      t('intl.usd', { price: formatUsd(value, locale), unit: t(`intl.units.${per}`) }),
    rate: (perUsd, currency) =>
      t('intl.rate', { rate: formatNumber(perUsd, locale, RATE_DECIMALS), currency }),
  }
}
