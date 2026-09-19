import { useMemo } from 'react'

import type { Compare } from '@/api/queries'
import { Card, CardList } from '@/components/Card/Card'
import { Tile } from '@/components/Tile/Tile'
import { useCountries } from '@/api/queries'
import { UiIcon } from '@/icons/ui'
import { monthLabels } from '@/i18n'
import { formatDay, formatMonth } from '@/lib/monthly'
import { useText } from '@/screens/shared/useText'
import type { PriceFormat } from '@/screens/shared/usePriceFormat'

import styles from './CropDetailScreen.module.css'

type OtherCountries = NonNullable<Compare['other_countries']>
type OtherRow = OtherCountries['rows'][number]
type WorldRow = NonNullable<OtherCountries['world']>

/** Why a row has no price, in the words the international screens already use. */
const REASON = { no_data: 'intl.noData', no_fx: 'intl.noRate' } as const

export interface OtherCountriesCardProps {
  others: OtherCountries
  today: string
  /** Formatter of the viewed country: `price_per_kg` is already in its currency. */
  fmt: PriceFormat
}

/**
 * 各國參考價 (docs/02 §5.4): the same crop's national price in the other countries that have
 * it — the median of that country's area prices on its own latest trading day — converted to
 * the viewer's currency, plus the World Bank's world price when there is a series for the crop.
 * Nothing here is selectable: it only tells the user whether the local price is high.
 * Wholesale and retail are not the same trade, so every line says which it is, and one note
 * line repeats the warning the About page spells out.
 */
export function OtherCountriesCard({ others, today, fmt }: OtherCountriesCardProps) {
  const { t, pick } = useText()
  const months = useMemo(() => monthLabels(t), [t])
  const countries = useCountries()
  const nameOf = (code: string) =>
    pick(countries.data?.countries.find((c) => c.code === code)?.name) || code

  const line = (row: OtherRow) => {
    const parts = [
      row.type ? t(`priceType.${row.type}`) : '',
      row.n_areas > 0 ? t('detail.compare.others.areaCount', { count: row.n_areas }) : '',
      row.trade_date ? formatDay(row.trade_date, months) : '',
    ].filter(Boolean)
    return (
      <Card
        key={row.country}
        lead={
          <Tile>
            <UiIcon name="globe" />
          </Tile>
        }
        name={nameOf(row.country)}
        meta={row.reason ? t(REASON[row.reason]) : parts.join(' · ')}
        price={row.price_per_kg === null ? null : fmt.price(row.price_per_kg)}
      />
    )
  }

  const worldLine = (world: WorldRow) => (
    <Card
      key="world"
      lead={
        <Tile>
          <UiIcon name="globe" />
        </Tile>
      }
      name={t('detail.compare.others.world')}
      meta={
        world.reason
          ? t(REASON[world.reason])
          : t('detail.compare.others.worldMeta', {
              month: formatMonth(world.month, today, months),
            })
      }
      price={world.price_per_kg === null ? null : fmt.price(world.price_per_kg)}
    />
  )

  const empty = others.rows.length === 0 && others.world === null
  return (
    <>
      <div className={styles.othersHead}>
        <b>{t('detail.compare.others.title')}</b>
        {others.fx_date && (
          <span>{t('intl.rateDate', { date: formatDay(others.fx_date, months) })}</span>
        )}
      </div>
      {empty ? (
        <div className={styles.othersNote}>{t('detail.compare.others.none')}</div>
      ) : (
        <>
          <CardList>
            {others.rows.map(line)}
            {others.world && worldLine(others.world)}
          </CardList>
          <div className={styles.othersNote}>{t('detail.compare.others.note')}</div>
        </>
      )}
    </>
  )
}
