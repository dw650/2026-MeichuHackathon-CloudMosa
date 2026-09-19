import { useMemo } from 'react'

import type { Country } from '@/api/queries'
import { monthLabels } from '@/i18n'
import { formatPercent, formatSignedPercent } from '@/lib/change'
import { formatNumber } from '@/lib/format'
import { formatMoney, formatMoneyDiff } from '@/lib/money'
import { formatUsd, type MonthLabels } from '@/lib/monthly'
import type { UnitSpec } from '@/lib/units'
import { useCountryData } from '@/screens/shared/useCountryData'
import { moneyUnitLabel, useDisplayCurrency } from '@/screens/shared/useDisplayCurrency'
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
  /** Day of the rates the prices are converted with; `null` for the payload's own day. */
  rateDate: string | null
  months: MonthLabels
  price(perKg: number | null | undefined): string
  diff(perKg: number | null | undefined): string
  percent(ratio: number | null | undefined): string
  signedPercent(ratio: number | null | undefined): string
  /** The published price with its unit: 471 美元/公噸, US$0.38/kg. */
  usd(value: number | null | undefined, unit: 'mt' | 'kg'): string
  /** 1 美元＝31.83 TWD, of the currency on screen. */
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
  // The same display currency as the daily prices (F19): the page's local prices are
  // converted once more, through lib/money and no other path.
  const fx = useDisplayCurrency()
  const localLabel = option
    ? pick(option.label)
    : t('intl.perKg', { currency: country?.currency ?? '' })
  return {
    locale,
    unitLabel: moneyUnitLabel(t, fx, unit.id, localLabel),
    rateDate: fx.rateDate,
    months,
    price: (perKg) => formatMoney(perKg, unit, locale, fx),
    diff: (perKg) => formatMoneyDiff(perKg, unit, locale, fx),
    percent: (ratio) => formatPercent(ratio, locale),
    signedPercent: (ratio) => formatSignedPercent(ratio, locale),
    usd: (value, per) =>
      t('intl.usd', { price: formatUsd(value, locale), unit: t(`intl.units.${per}`) }),
    rate: (perUsd, currency) =>
      t('intl.rate', {
        rate: formatNumber(fx.perUsd ?? perUsd, locale, RATE_DECIMALS),
        currency: fx.converted ? fx.currency : currency,
      }),
  }
}
