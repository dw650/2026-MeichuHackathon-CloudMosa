import { useMemo } from 'react'

import { conversion, type Conversion } from '@/lib/money'
import { useSettings } from '@/store/settings'

import { useCountryData } from './useCountryData'
import type { Text } from './useText'

/**
 * How the prices of the chosen country (or of `code`) are shown: in its own currency, or in
 * the one picked in 設定 → 顯示幣別 (F19, docs/02 §5.7). Every screen that shows a price takes
 * its conversion from here, so a price is converted once and always the same way.
 */
export function useDisplayCurrency(code?: string | null): Conversion {
  const wanted = useSettings((s) => s.displayCurrency)
  const { country, fxRates } = useCountryData(code)
  const local = country?.currency
  return useMemo(() => conversion(local, wanted, fxRates), [local, wanted, fxRates])
}

/** Unit ids with a name of their own in i18n (docs/06 §5). */
const UNIT_KEYS = ['kg', 'qtl', 'catty', 'kati'] as const
type UnitKey = (typeof UNIT_KEYS)[number]
const isUnitKey = (id: string): id is UnitKey => UNIT_KEYS.some((key) => key === id)

/**
 * The label over the prices: the country's own (元/公斤, ₹/qtl), which already carries its
 * currency, or the display currency's symbol over the unit's name (NT$/公斤) once converted.
 */
export function moneyUnitLabel(
  t: Text['t'],
  fx: Conversion,
  unitId: string,
  localLabel: string,
): string {
  if (!fx.converted) return localLabel
  const unit = isUnitKey(unitId) ? t(`currency.units.${unitId}`) : unitId
  return t('currency.unitLabel', { symbol: fx.symbol, unit })
}
