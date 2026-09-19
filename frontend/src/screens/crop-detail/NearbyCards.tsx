import { Card } from '@/components/Card/Card'
import { Pill } from '@/components/Pill/Pill'
import { Tile } from '@/components/Tile/Tile'
import { UiIcon } from '@/icons/ui'
import type { PriceFormat } from '@/screens/shared/usePriceFormat'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useText } from '@/screens/shared/useText'

import styles from './CropDetailScreen.module.css'
import { type Nearby, type NearbyRow, nearbySlots } from './nearbyRows'

export interface NearbyCardsProps {
  nearby: Nearby
  fmt: PriceFormat
  /** Digit key cap of a selectable row, from its place in the tab's focus list. */
  keyCapOf(focusId: string): number | undefined
}

/**
 * 附近最高／附近最低 (docs/02 §5.4): the nearby area with the highest and the one with the
 * lowest price on the same trade date as the viewed area, each with its gap to it and its
 * straight-line distance. When the viewed area is the highest (or lowest) itself, its own row
 * says so with 「你」 instead, first and without a price (the hero above has it).
 * Role-neutral: the same two rows serve sellers and buyers.
 */
export function NearbyCards({ nearby, fmt, keyCapOf }: NearbyCardsProps) {
  const { t, pick } = useText()
  const catalog = useCountryData()
  const name = (row: NearbyRow) => (
    <>
      {pick(catalog.area(row.area_id)?.name) || row.area_id}
      <span className={styles.suffix}>{pick(catalog.country?.area_suffix)}</span>
    </>
  )
  return nearbySlots(nearby).map(({ focusId, side }) => {
    const row = nearby[side]
    if (row.is_base) {
      return (
        <Card
          key={focusId}
          variant="mine"
          lead={
            <Tile>
              <UiIcon name="pin" />
            </Tile>
          }
          name={name(row)}
          meta={t(`detail.today.nearby.${side}`)}
          trailing={<Pill kind="you" text={t('detail.compare.you')} />}
        />
      )
    }
    return (
      <Card
        key={focusId}
        focusId={focusId}
        lead={
          <Tile keyCap={keyCapOf(focusId)}>
            <UiIcon name="route" />
          </Tile>
        }
        name={name(row)}
        meta={t(`detail.today.nearby.${side}At`, {
          distance: t('common.distance', { km: row.distance_km }),
        })}
        price={fmt.price(row.price_per_kg)}
        pill={{
          kind: fmt.diffDirection(row.diff_per_kg) ?? 'flat',
          text: fmt.diff(row.diff_per_kg),
        }}
      />
    )
  })
}
