import { useEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigationType, useParams, useSearchParams } from 'react-router'

import { errorKind } from '@/api/client'
import { type Market, useMarket, useRefresh } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths } from '@/app/paths'
import { Card, CardList, Chevron } from '@/components/Card/Card'
import { type Tone, toneOf } from '@/components/categories'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import { cx } from '@/components/cx'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { Pill } from '@/components/Pill/Pill'
import { PriceTypeTag } from '@/components/PriceTypeTag/PriceTypeTag'
import { Shell } from '@/components/Shell/Shell'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { type DateLabels, describeFreshness, formatDate, formatTime } from '@/lib/dates'
import { MISSING } from '@/lib/format'
import { useCountryData } from '@/screens/shared/useCountryData'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './markets.module.css'
import { Failed, LoadingNote, OldDataCard } from './parts'
import { marketShown, stepsBack } from './trail'

interface RangeBarProps {
  low: number
  high: number
  price: number
  tone: Tone
  format(perKg: number): string
}

/** The day's range: a bar from the low to the high price, with a marker at the price. */
function RangeBar({ low, high, price, tone, format }: RangeBarProps) {
  const span = high - low
  // Kept off the very ends so the marker never sticks out of the bar.
  const at = span > 0 ? Math.min(96, Math.max(4, ((price - low) / span) * 100)) : 50
  return (
    <div className={styles.box} data-tone={tone}>
      <div className={styles.bar}>
        <span className={styles.marker} style={{ left: `${at}%` }} />
      </div>
      <div className={styles.ends}>
        <span>{format(low)}</span>
        <span>{format(high)}</span>
      </div>
    </div>
  )
}

/** When the shown data was fetched, for 「先顯示 {time} 的資料」. */
function fetchedAt(market: Market, dates: DateLabels): string {
  const time = formatTime(market.fetched_at)
  return time === MISSING ? formatDate(market.trade_date, dates) : time
}

/**
 * 單一市場 (F05, docs/02 §5.5): one market's representative price (India modal, Taiwan average),
 * its change, the day's range and the source. Markets have no retail price: retail offers the
 * area's retail price instead, which returns to the crop detail without adding history.
 */
export default function MarketScreen() {
  const { cropId = '', marketId = '' } = useParams()
  const [search] = useSearchParams()
  const { key } = useLocation()
  const action = useNavigationType()
  const nav = useNav()
  const { t, lang, pick, dates } = useText()
  const { country, crop, area } = useCountryData()
  const fmt = usePriceFormat()
  const countryCode = useSettings((s) => s.country)
  const myAreaId = useSettings((s) => s.areaId)
  const togglePriceType = useSettings((s) => s.togglePriceType)
  const refresh = useRefresh()
  const root = useRef<HTMLDivElement>(null)

  const query = useMarket(
    countryCode ? { country: countryCode, crop: cropId, market: marketId } : null,
  )
  const market = query.isPlaceholderData ? undefined : query.data
  const areaId = search.get('area') ?? market?.area_id ?? myAreaId ?? ''
  const areaName = areaLabel(area(areaId), country, lang)
  const retail = fmt.type === 'retail'
  const oldData = market !== undefined && query.isError
  const failed = market === undefined && query.isError && !query.isFetching

  let ids: string[] = []
  if (retail) ids = ['retail']
  else if (oldData || failed) ids = ['retry']

  const activate = (id: string) => {
    if (id === 'retry') void refresh()
    else nav.backAndReplace(paths.crop(cropId, 'today', areaId), stepsBack(key))
  }
  const list = useFocusList(ids, { root, onActivate: activate })
  // No menu here (left soft key blank) and `#` has no job.
  useKeys({ ...list.keys, onStar: togglePriceType })
  useEffect(() => marketShown(key, action), [key, action])

  if (query.isError && errorKind(query.error) !== 'unavailable') {
    return <Navigate to={paths.home()} replace />
  }

  let center = ''
  if (retail) center = t('softkeys.select')
  else if (list.focusedId === 'retry') center = t('softkeys.retry')

  const cropInfo = crop(cropId)
  const fresh = market && describeFreshness(market.staleness, market.trade_date, dates)
  const showsFreshness = !retail && fresh && market.staleness.state !== 'none' && fresh.text

  let body
  if (retail) {
    body = (
      <>
        <StatusBox icon="store" title={t('markets.noRetail')} details={[t('states.retailNote')]} />
        <CardList>
          <Card
            focusId="retail"
            lead={
              <Tile>
                <UiIcon name="pin" />
              </Tile>
            }
            name={t('markets.seeAreaRetail', { area: areaName })}
            trailing={<Chevron />}
          />
        </CardList>
      </>
    )
  } else if (market) {
    const { price_per_kg: price, low_per_kg: low, high_per_kg: high, change } = market
    const source = [pick(country?.source_label), pick(market.source?.name)].filter(Boolean)
    body = (
      <>
        {oldData && <OldDataCard since={fetchedAt(market, dates)} />}
        {price === null ? (
          <StatusBox icon="store" title={t('freshness.none')} />
        ) : (
          <div className={styles.stack}>
            <div className={cx(styles.box, styles.hero)}>
              <span className={styles.heroTile}>
                <CropIcon crop={cropId} category={cropInfo?.category} />
              </span>
              <div className={styles.heroText}>
                <div className={styles.label}>
                  {pick(country?.rep_price_label)} · {fmt.unitLabel}
                </div>
                <div className={styles.big}>{fmt.price(price)}</div>
                {change && (
                  <div className={styles.change}>
                    <Pill kind={change.direction} text={fmt.percent(change.pct)} />
                    <span className={styles.vsPrev}>{t('detail.today.vsPrev')}</span>
                  </div>
                )}
              </div>
            </div>
            {low !== null && high !== null && (
              <RangeBar
                low={low}
                high={high}
                price={price}
                tone={toneOf(cropInfo?.category)}
                format={fmt.price}
              />
            )}
            <p className={styles.source}>
              <UiIcon name="shield" />
              <span>{source.join(' · ')}</span>
            </p>
          </div>
        )}
      </>
    )
  } else if (failed) {
    body = <Failed />
  } else {
    body = (
      <>
        <CardList>
          <Card
            lead={
              <Tile>
                <UiIcon name="store" />
              </Tile>
            }
            name={<Skeleton width={64} />}
            loading
          />
        </CardList>
        <LoadingNote area={areaName} />
      </>
    )
  }

  return (
    <Shell title={pick(cropInfo?.name)} softKeys={{ left: '', center, right: t('softkeys.back') }}>
      <div ref={root}>
        <InfoBar
          small={<PriceTypeTag type={fmt.type} label={t(`priceType.${fmt.type}`)} />}
          left={
            <>
              <UiIcon name="store" />
              <b>{pick(market?.name)}</b>
            </>
          }
          right={
            <>
              <KeyCap>*</KeyCap>
              <PriceTypeTag type={fmt.type} label={t(`priceType.${fmt.type}`)} />
              {showsFreshness && (
                <span className={fresh.warn ? styles.warn : undefined}>{fresh.text}</span>
              )}
            </>
          }
        />
        {body}
      </div>
    </Shell>
  )
}
