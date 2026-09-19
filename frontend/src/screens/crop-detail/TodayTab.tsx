import { useRef } from 'react'

import type { Quote } from '@/api/queries'
import { paths } from '@/app/paths'
import { Card, CardList, Chevron } from '@/components/Card/Card'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import { cx } from '@/components/cx'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { type Metric, MetricGrid } from '@/components/MetricGrid/MetricGrid'
import { Pill } from '@/components/Pill/Pill'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import type { KeyHandlers } from '@/keys/keyScope'
import { useKeys } from '@/keys/useKeys'
import { DIRECTION_GLYPH, directionOf } from '@/lib/change'
import { describeFreshness } from '@/lib/dates'
import { MISSING } from '@/lib/format'
import { usePriceFormat, type PriceFormat } from '@/screens/shared/usePriceFormat'
import { useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './CropDetailScreen.module.css'
import { DetailFrame } from './DetailFrame'
import { NearbyCards } from './NearbyCards'
import { type NearbyTarget, nearbyTargets } from './nearbyRows'
import { ExitCard, FailedState, LoadingState, NoRetailState, StaleDataCard } from './states'
import { type Detail, isNoRetail, RETRY, stageOf, useDetailQuote, WHOLESALE } from './useDetail'

const MARKETS = 'markets'
const OTHER_AREAS = 'other-areas'
const TREND = 'trend'
/** 「通常 14:00 前更新」: the mockup's time; the API has no per-area update time yet. */
const USUAL_UPDATE = '14:00'
/** Arrivals within ±5% of the 7-day average get no ▲▼ (mockup). */
const ARRIVALS_STEADY = 0.05

type Text = ReturnType<typeof useText>['t']

/** Wholesale: 到貨量 as 「偏多 ▲18%」; retail has no arrivals and shows 波動 instead. */
function secondMetric(quote: Quote, fmt: PriceFormat, t: Text): Metric {
  const { stats } = quote
  if (quote.type === 'retail') {
    return {
      label: t('detail.stats.volatility.label'),
      value: stats.volatility ? t(`detail.stats.volatility.${stats.volatility}`) : MISSING,
    }
  }
  const ratio = stats.arrivals_ratio === null ? 0 : stats.arrivals_ratio - 1
  const trend =
    Math.abs(ratio) < ARRIVALS_STEADY
      ? ''
      : ` ${DIRECTION_GLYPH[ratio > 0 ? 'up' : 'down']}${fmt.percent(ratio)}`
  return {
    label: t('detail.stats.arrivals.label'),
    value: stats.arrivals ? t(`detail.stats.arrivals.${stats.arrivals}`) + trend : MISSING,
  }
}

function metricsOf(quote: Quote, fmt: PriceFormat, t: Text): Metric[] {
  const { vs_avg7_pct: vsAvg, pos30 } = quote.stats
  const level = pos30 === null ? null : pos30 < 0.34 ? 'low' : pos30 > 0.66 ? 'high' : 'mid'
  return [
    {
      label: t('detail.stats.vsAvg7'),
      value: fmt.signedPercent(vsAvg),
      direction: directionOf(vsAvg) ?? undefined,
    },
    secondMetric(quote, fmt, t),
    {
      label: t('detail.stats.position30.label'),
      value:
        pos30 === null || level === null
          ? MISSING
          : `${t(`detail.stats.position30.${level}`)} ${Math.round(pos30 * 100)}%`,
      gauge: pos30 ?? undefined,
    },
  ]
}

interface ContentProps {
  detail: Detail
  quote: Quote
  fmt: PriceFormat
}

interface ReadyProps extends ContentProps {
  /** Digit key cap of a selectable nearby row. */
  keyCapOf(focusId: string): number | undefined
}

/** The big price card: crop tile, what the price is, the price and its change. */
function Hero({ detail, quote, fmt }: ContentProps) {
  const { t } = useText()
  const { markets, change } = quote
  const what =
    quote.price_per_kg === null
      ? t('freshness.none')
      : quote.type === 'retail'
        ? t('detail.today.retailSurvey')
        : markets?.count === 1
          ? t('detail.today.oneMarket')
          : t('detail.today.median', { count: markets?.count ?? 0 })
  return (
    <div className={cx(styles.box, styles.hero)}>
      <span className={styles.heroTile}>
        <CropIcon crop={detail.cropId} tone={detail.tone} />
      </span>
      <div className={styles.heroBody}>
        <div className={styles.label}>
          <span className={styles.labelText}>
            {quote.price_per_kg === null ? what : `${what} · ${fmt.unitLabel}`}
          </span>
          {/* Voice readout is bonus B8: the 0 key does nothing yet. */}
          <span className={styles.listen}>
            <KeyCap>0</KeyCap>
            <UiIcon name="speaker" />
          </span>
        </div>
        <div className={styles.big}>{fmt.price(quote.price_per_kg)}</div>
        {change && quote.price_per_kg !== null && (
          <div className={styles.change}>
            <Pill kind={change.direction} text={fmt.percent(change.pct)} />
            <b>{fmt.diff(change.diff_per_kg)}</b>
            <span className={styles.vsPrev}>{t('detail.today.vsPrev')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Normal content: hero, the markets card (wholesale) or the retail note, three metrics, then
 * the highest and lowest nearby prices. The nearby rows come last so that everything above
 * them shows on the way down to them.
 */
function Ready({ detail, quote, fmt, keyCapOf }: ReadyProps) {
  const { t } = useText()
  const { markets } = quote
  return (
    <div className={styles.stack}>
      <Hero detail={detail} quote={quote} fmt={fmt} />
      {quote.type === 'wholesale' && markets && markets.total > 0 && (
        <Card
          focusId={MARKETS}
          lead={
            <Tile>
              <UiIcon name="store" />
            </Tile>
          }
          name={t('detail.today.markets', { count: markets.total })}
          meta={
            markets.max_per_kg === null || markets.min_per_kg === null
              ? undefined
              : t('detail.today.marketsRange', {
                  high: fmt.price(markets.max_per_kg),
                  low: fmt.price(markets.min_per_kg),
                })
          }
          trailing={<Chevron okKey />}
        />
      )}
      {quote.type === 'retail' && (
        <div className={cx(styles.box, styles.note)}>
          <UiIcon name="info" />
          {t('states.retailNote')}
        </div>
      )}
      {quote.price_per_kg !== null && (
        <MetricGrid items={metricsOf(quote, fmt, t)} tone={detail.tone} />
      )}
      {quote.nearby && <NearbyCards nearby={quote.nearby} fmt={fmt} keyCapOf={keyCapOf} />}
    </div>
  )
}

/** The area has not reported today: the latest price and two ways on (docs/02 §6). */
function NotUpdated({ detail, quote, fmt }: ContentProps) {
  const { t, dates } = useText()
  const { text } = describeFreshness(quote.staleness, quote.trade_date, dates)
  return (
    <>
      <StatusBox
        icon="store"
        title={t('states.notUpdated', { area: detail.areaName })}
        details={[
          t('states.usualUpdate', { time: USUAL_UPDATE }),
          t('states.lastPrice', {
            when: text,
            price: `${fmt.price(quote.price_per_kg)} ${fmt.unitLabel}`,
          }),
        ]}
      />
      <CardList>
        <ExitCard focusId={OTHER_AREAS} icon="store" label={t('states.otherAreas')} keyCap={1} />
        <ExitCard focusId={TREND} icon="trend" label={t('states.seeTrend')} keyCap={2} />
      </CardList>
    </>
  )
}

type View = 'loading' | 'failed' | 'noRetail' | 'notUpdated' | 'ready'

const ITEMS: Record<View, (wholesaleMarkets: boolean) => string[]> = {
  loading: () => [],
  failed: () => [RETRY],
  noRetail: () => [WHOLESALE],
  notUpdated: () => [OTHER_AREAS, TREND],
  ready: (markets) => (markets ? [MARKETS] : []),
}

/** 行情 (T27): today's price of the crop in the viewed area. */
export function TodayTab({ detail }: { detail: Detail }) {
  const { t } = useText()
  const { nav } = detail
  const fmt = usePriceFormat()
  const setPriceType = useSettings((s) => s.setPriceType)
  const quote = useDetailQuote(detail)
  const data = quote.data
  const stage = stageOf(data, quote.error)
  const view: View =
    stage !== 'ready' || !data
      ? stage
      : isNoRetail(data.reason)
        ? 'noRetail'
        : data.staleness.state === 'stale' && data.price_per_kg !== null
          ? 'notUpdated'
          : 'ready'
  const withMarkets = data?.type === 'wholesale' && (data.markets?.total ?? 0) > 0
  const nearby: NearbyTarget[] = view === 'ready' ? nearbyTargets(data?.nearby) : []
  // Old data after a failed refresh: an alert card on top retries (docs/02 §6).
  const oldData = stage === 'ready' && quote.error !== null
  const digitOffset = oldData ? 1 : 0
  const ids = [
    ...(oldData ? [RETRY] : []),
    ...ITEMS[view](withMarkets),
    ...nearby.map((n) => n.focusId),
  ]
  const nearbyArea = (id: string) => nearby.find((n) => n.focusId === id)?.areaId
  const keyCapOf = (id: string) => {
    const digit = ids.indexOf(id) + 1 - digitOffset
    return digit >= 1 && digit <= 9 ? digit : undefined
  }

  const root = useRef<HTMLDivElement>(null)
  const goCompare = () => nav.switchTab(detail.tabUrl('compare'))
  const list = useFocusList(ids, {
    root,
    digitOffset,
    active: !nav.sheet,
    onActivate: (id) => {
      const area = nearbyArea(id)
      if (id === RETRY) quote.refresh()
      else if (id === WHOLESALE) setPriceType('wholesale')
      else if (id === OTHER_AREAS) goCompare()
      else if (id === TREND) nav.switchTab(detail.tabUrl('trend'))
      else if (id === MARKETS) nav.open(paths.markets(detail.cropId, detail.areaId))
      // The same as picking an area on the compare tab.
      else if (area) nav.open(paths.crop(detail.cropId, 'today', area))
    },
  })
  const keys: KeyHandlers = {
    ...list.keys,
    ...detail.keys,
    onHash: () => nav.openSheet('area'),
  }
  // Nothing to select (retail): OK goes on to the compare tab, as the centre key says.
  if (list.focusedId === null && view === 'ready') keys.onEnter = goCompare
  useKeys(keys)

  const center =
    list.focusedId === null
      ? view === 'ready'
        ? t('softkeys.compare')
        : ''
      : list.focusedId === MARKETS
        ? t('softkeys.markets')
        : list.focusedId === RETRY
          ? t('softkeys.retry')
          : nearbyArea(list.focusedId)
            ? t('softkeys.view')
            : t('softkeys.select')

  return (
    <DetailFrame
      detail={detail}
      quote={quote}
      softKeys={{ left: t('softkeys.menu'), center, right: t('softkeys.back') }}
    >
      <div ref={root}>
        {oldData && (
          <CardList>
            <StaleDataCard fetchedAt={data?.fetched_at ?? null} />
          </CardList>
        )}
        {view === 'loading' && <LoadingState areaName={detail.areaName} />}
        {view === 'failed' && <FailedState />}
        {view === 'noRetail' && data && isNoRetail(data.reason) && (
          <NoRetailState reason={data.reason} />
        )}
        {view === 'notUpdated' && data && <NotUpdated detail={detail} quote={data} fmt={fmt} />}
        {view === 'ready' && data && (
          <Ready detail={detail} quote={data} fmt={fmt} keyCapOf={keyCapOf} />
        )}
      </div>
    </DetailFrame>
  )
}
