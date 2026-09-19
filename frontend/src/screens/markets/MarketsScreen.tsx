import { useEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigationType, useParams, useSearchParams } from 'react-router'

import { errorKind } from '@/api/client'
import { type MarketRow, useMarkets, useRefresh } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths } from '@/app/paths'
import { Card, CardList, Chevron } from '@/components/Card/Card'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { FxNote } from '@/screens/shared/FxNote'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { Note } from '@/components/Note/Note'
import { PriceTypeTag } from '@/components/PriceTypeTag/PriceTypeTag'
import { Shell } from '@/components/Shell/Shell'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { describeFreshness, formatDate } from '@/lib/dates'
import { AreaSheet } from '@/screens/shared/AreaSheet'
import { MenuSheet } from '@/screens/shared/MenuSheet'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useEstimate } from '@/screens/shared/useEstimate'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './markets.module.css'
import { Failed, LoadingNote, OldDataCard } from './parts'
import { listShown, openingMarket } from './trail'

const MARKET = 'market:'
const SKELETON_ROWS = [1, 2, 3]

/** Markets without a price go last; otherwise the API's order (price high → low) stays. */
function ranked(rows: readonly MarketRow[]): MarketRow[] {
  const missing = (row: MarketRow) => Number(row.price_per_kg === null)
  return [...rows].sort((a, b) => missing(a) - missing(b))
}

/**
 * 本地區各市場 (F05, docs/02 §5.5): one crop's markets in the viewed area (`?area=`, else my
 * area), ranked by price against the area median. Wholesale only: retail shows a note instead.
 */
export default function MarketsScreen() {
  const { cropId = '' } = useParams()
  const [search] = useSearchParams()
  const { key } = useLocation()
  const action = useNavigationType()
  const nav = useNav()
  const { t, lang, pick, dates } = useText()
  const { country, crop, area } = useCountryData()
  const fmt = usePriceFormat()
  const estimate = useEstimate()
  const countryCode = useSettings((s) => s.country)
  const myAreaId = useSettings((s) => s.areaId)
  const setPriceType = useSettings((s) => s.setPriceType)
  const togglePriceType = useSettings((s) => s.togglePriceType)
  const refresh = useRefresh()
  const root = useRef<HTMLDivElement>(null)

  const areaId = search.get('area') ?? myAreaId ?? ''
  const areaName = areaLabel(area(areaId), country, lang)
  const retail = fmt.type === 'retail'
  const query = useMarkets(
    !retail && countryCode && areaId ? { country: countryCode, area: areaId, crop: cropId } : null,
  )
  // Another area's list is not shown while this one loads.
  const markets = retail || query.isPlaceholderData ? undefined : query.data
  const rows = markets ? ranked(markets.rows) : []
  const oldData = markets !== undefined && query.isError
  const failed = !retail && markets === undefined && query.isError && !query.isFetching

  let ids: string[] = []
  if (retail) ids = ['wholesale']
  else if (markets) ids = [...(oldData ? ['retry'] : []), ...rows.map((r) => MARKET + r.market_id)]
  else if (failed) ids = ['retry']

  const activate = (id: string) => {
    if (id === 'wholesale') setPriceType('wholesale')
    else if (id === 'retry') void refresh()
    else {
      openingMarket(key)
      nav.open(paths.market(cropId, id.slice(MARKET.length), areaId))
    }
  }
  const list = useFocusList(ids, {
    root,
    onActivate: activate,
    digitOffset: oldData ? 1 : 0,
    active: !nav.sheet,
  })
  useKeys({
    ...list.keys,
    onMenu: () => nav.openSheet('menu'),
    onHash: () => nav.openSheet('area'),
    onStar: togglePriceType,
  })
  useEffect(() => {
    if (!nav.sheet) listShown(key, action)
  }, [key, action, nav.sheet])

  if (query.isError && errorKind(query.error) !== 'unavailable') {
    return <Navigate to={paths.home()} replace />
  }

  let center = ''
  if (retail) center = t('softkeys.select')
  else if (list.focusedId === 'retry') center = t('softkeys.retry')
  else if (list.focusedId) center = t('softkeys.open')

  const marketCard = (row: MarketRow, index: number) => {
    const fresh = describeFreshness(row.staleness, row.trade_date, dates)
    const km = row.km_from_center
    const direction = fmt.diffDirection(row.diff_per_kg)
    return (
      <Card
        key={row.market_id}
        focusId={MARKET + row.market_id}
        lead={<Tile round>{index + 1}</Tile>}
        name={pick(row.name)}
        meta={
          <>
            {km !== null && t('markets.distance', { km })}
            {km !== null && fresh.text && ' · '}
            {fresh.text && (
              <span className={fresh.warn ? styles.warn : undefined}>{fresh.text}</span>
            )}
          </>
        }
        price={row.price_per_kg === null ? null : fmt.price(row.price_per_kg)}
        pill={direction ? { kind: direction, text: fmt.diff(row.diff_per_kg) } : undefined}
      />
    )
  }

  let body
  if (retail) {
    body = (
      <>
        <StatusBox icon="store" title={t('states.retailNote')} />
        <CardList>
          <Card
            focusId="wholesale"
            lead={
              <Tile>
                <UiIcon name="scale" />
              </Tile>
            }
            name={t('priceType.switchTo.wholesale')}
            trailing={<Chevron />}
          />
        </CardList>
      </>
    )
  } else if (markets) {
    body = (
      <>
        {oldData && <OldDataCard since={formatDate(markets.trade_date, dates)} />}
        {markets.median_per_kg !== null && (
          <p className={styles.note}>
            {t('markets.vsMedian', { price: fmt.price(markets.median_per_kg) })}
          </p>
        )}
        <Note text={estimate.note('wholesale', cropId)} />
        {rows.length > 0 ? (
          <div className={styles.rows}>
            <CardList>{rows.map(marketCard)}</CardList>
          </div>
        ) : (
          <StatusBox icon="store" title={t('freshness.none')} />
        )}
      </>
    )
  } else if (failed) {
    body = <Failed />
  } else {
    body = (
      <>
        <CardList>
          {SKELETON_ROWS.map((n) => (
            <Card key={n} lead={<Tile round>{n}</Tile>} name={<Skeleton width={64} />} loading />
          ))}
        </CardList>
        <LoadingNote area={areaName} />
      </>
    )
  }

  let overlay
  if (nav.sheet === 'menu') overlay = <MenuSheet areaFor="view" />
  else if (nav.sheet === 'area') overlay = <AreaSheet areaFor="view" currentAreaId={areaId} />

  return (
    <Shell
      title={pick(crop(cropId)?.name)}
      softKeys={{ left: t('softkeys.menu'), center, right: t('softkeys.back') }}
      overlay={overlay}
    >
      <div ref={root}>
        <InfoBar
          small={<PriceTypeTag type={fmt.type} label={estimate.typeLabel(fmt.type)} />}
          left={
            <>
              <UiIcon name="pin" />
              <b>{areaName}</b>
              <KeyCap>#</KeyCap>
            </>
          }
          right={
            <>
              <KeyCap>*</KeyCap>
              <PriceTypeTag type={fmt.type} label={estimate.typeLabel(fmt.type)} />
              {fmt.unitLabel}
            </>
          }
        />
        <FxNote />
        {body}
      </div>
    </Shell>
  )
}
