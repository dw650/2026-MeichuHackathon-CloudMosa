import type { PriceType } from '@/api/queries'

import { useCountryData } from './useCountryData'
import { useText } from './useText'

export interface Estimate {
  /** True when the country has no source for this price type and it is worked out from the
   *  other one (docs/06 §3.6). */
  isEstimated(type: PriceType): boolean
  /** The price type's tag: 「≈零售」 while it is an estimate, 「零售」 otherwise. Every screen
   *  shows the tag, so an estimated price is never on screen without its mark. */
  typeLabel(type: PriceType): string
  /**
   * The line a screen shows under the prices, naming the ratio when it knows the crop
   * (「零售價由批發價 ×1.7 推估，僅供參考」); null when nothing is estimated. One line per
   * screen: the same hint is never shown twice (docs/03 §5).
   */
  note(type: PriceType, cropId?: string | null): string | null
}

/**
 * Whether the price type on screen is an estimate, and how to say so. A country's real source
 * reports one price type only (Taiwan and India wholesale, Malaysia retail); the other is
 * estimated from it and must always be labelled as one (docs/02 §2).
 */
export function useEstimate(): Estimate {
  const { t } = useText()
  const { country, crop } = useCountryData()
  const estimated = country?.estimated_price_types ?? []
  const isEstimated = (type: PriceType) => estimated.includes(type)
  return {
    isEstimated,
    typeLabel: (type) => {
      const label = t(`priceType.${type}`)
      return isEstimated(type) ? t('estimate.tag', { label }) : label
    },
    note: (type, cropId) => {
      if (!isEstimated(type)) return null
      const ratio = cropId ? crop(cropId)?.estimate_ratio : null
      return ratio ? t(`estimate.${type}Ratio`, { ratio }) : t(`estimate.${type}`)
    },
  }
}
