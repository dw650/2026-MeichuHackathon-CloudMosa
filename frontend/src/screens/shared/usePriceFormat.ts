import type { Country, PriceType } from '@/api/queries'
import {
  type Direction,
  formatPercent,
  formatSignedPercent,
  priceDiffDirection,
} from '@/lib/change'
import { formatPrice, formatPriceDiff } from '@/lib/format'
import { defaultUnitTable, resolveUnit, type UnitChoice, type UnitSpec } from '@/lib/units'
import { useSettings } from '@/store/settings'

import { useCountryData } from './useCountryData'
import { useText } from './useText'

export interface PriceFormat {
  type: PriceType
  unit: UnitSpec
  /** e.g. ₹/公擔, NT$/kg (docs/06 §5). */
  unitLabel: string
  locale: string
  /** A per-kg price in the chosen unit; null → 「—」. */
  price(perKg: number | null | undefined): string
  /** A signed per-kg difference in the chosen unit (+95, −3.2, ±0). */
  diff(perKg: number | null | undefined): string
  diffDirection(perKg: number | null | undefined): Direction | null
  /** 4.2%, 12% (size only; pair it with the ▲▼＝ glyph). */
  percent(ratio: number | null | undefined): string
  signedPercent(ratio: number | null | undefined): string
}

/** The country's units from the API; until they arrive, the static table of the chosen country. */
function unitChoice(
  country: Country | undefined,
  code: string | null,
  type: PriceType,
): UnitChoice {
  const set = country?.units[type]
  if (set) {
    return {
      defaultId: set.default,
      options: set.options.map((o) => ({ id: o.id, perKg: o.per_kg, decimals: o.decimals })),
    }
  }
  return defaultUnitTable(country?.code ?? code)[type]
}

/** Unit, locale and formatters for the chosen (or given) price type (docs/03 §7, docs/06 §5). */
export function usePriceFormat(type?: PriceType): PriceFormat {
  const chosenType = useSettings((s) => s.priceType)
  const units = useSettings((s) => s.units)
  const code = useSettings((s) => s.country)
  const { country } = useCountryData()
  const { pick } = useText()
  const priceType = type ?? chosenType
  const unit = resolveUnit(unitChoice(country, code, priceType), units[priceType])
  const option = country?.units[priceType].options.find((o) => o.id === unit.id)
  const locale = country?.locale ?? 'en-IN'
  return {
    type: priceType,
    unit,
    unitLabel: pick(option?.label),
    locale,
    price: (perKg) => formatPrice(perKg, unit, locale),
    diff: (perKg) => formatPriceDiff(perKg, unit, locale),
    diffDirection: (perKg) => priceDiffDirection(perKg, unit),
    percent: (ratio) => formatPercent(ratio, locale),
    signedPercent: (ratio) => formatSignedPercent(ratio, locale),
  }
}
