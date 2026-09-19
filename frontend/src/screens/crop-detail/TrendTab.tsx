import { useRef } from 'react'

import type { Quote } from '@/api/queries'
import { CardList } from '@/components/Card/Card'
import { toneOf } from '@/components/categories'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { MetricGrid } from '@/components/MetricGrid/MetricGrid'
import { Pill } from '@/components/Pill/Pill'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { TrendChart, type TrendPoint } from '@/components/TrendChart/TrendChart'
import { cx } from '@/components/cx'
import { useFocusList } from '@/focus/useFocusList'
import type { KeyHandlers } from '@/keys/keyScope'
import { useKeys } from '@/keys/useKeys'
import { directionOf } from '@/lib/change'
import { parseLocalDate } from '@/lib/dates'
import { MISSING } from '@/lib/format'
import { useCountryData } from '@/screens/shared/useCountryData'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './CropDetailScreen.module.css'
import { DetailFrame } from './DetailFrame'
import { FailedState, LoadingState, NoRetailState, StaleDataCard } from './states'
import {
  type Days,
  type Detail,
  isNoRetail,
  RETRY,
  stageOf,
  useDetailQuote,
  WHOLESALE,
} from './useDetail'

/** Days of the chosen range, oldest first, labelled for the X axis (docs/03 §4). */
function pointsOf(
  quote: Quote,
  days: Days,
  weekdays: readonly string[],
  zh: boolean,
  closedWeekdays: readonly number[],
) {
  return quote.series.slice(-days).map((point): TrendPoint => {
    const date = parseLocalDate(point.date)
    const weekday = date ? (weekdays[date.weekday] ?? '') : ''
    // Only the country's closed weekdays (ISO, 7 = Sunday) read 休; other gaps are missing data.
    const isoWeekday = date ? (date.weekday === 0 ? 7 : date.weekday) : 0
    return {
      value: point.price_per_kg,
      closed: point.price_per_kg === null && closedWeekdays.includes(isoWeekday),
      // 7 days: the weekday's initial (六, Sa); 30 days: 9/19 (the chart picks a few).
      label: !date ? '' : days === 7 ? weekday.slice(0, zh ? 1 : 2) : `${date.month}/${date.day}`,
    }
  })
}

/** 走勢 (T28): the 7- or 30-day line with its high, low and swing. */
export function TrendTab({ detail }: { detail: Detail }) {
  const { t, lang, dates } = useText()
  const { nav, days } = detail
  const fmt = usePriceFormat()
  const setPriceType = useSettings((s) => s.setPriceType)
  const closedWeekdays = useCountryData().country?.closed_weekdays ?? []
  const quote = useDetailQuote(detail)
  const data = quote.data
  const stage = stageOf(data, quote.error)
  const noRetail = data && isNoRetail(data.reason) ? data.reason : null
  const points = data
    ? pointsOf(data, days, dates.weekdays, lang.startsWith('zh'), closedWeekdays)
    : []
  const empty = points.every((point) => point.value === null)
  const oldData = stage === 'ready' && quote.error !== null
  const ids = [
    ...(oldData ? [RETRY] : []),
    ...(stage === 'failed' ? [RETRY] : noRetail ? [WHOLESALE] : []),
  ]

  const root = useRef<HTMLDivElement>(null)
  const goToday = () => nav.switchTab(detail.tabUrl('today'))
  const list = useFocusList(ids, {
    root,
    active: !nav.sheet,
    onActivate: (id) => (id === RETRY ? quote.refresh() : setPriceType('wholesale')),
  })
  const keys: KeyHandlers = {
    ...list.keys,
    ...detail.keys,
    // `#` here switches 7 ⇄ 30 days (docs/02 §4); the range stays in the URL.
    onHash: () => nav.switchTab(detail.urlWith('days', days === 7 ? '30' : undefined)),
  }
  if (list.focusedId === null && stage === 'ready') keys.onEnter = goToday
  useKeys(keys)

  const center =
    list.focusedId === RETRY
      ? t('softkeys.retry')
      : list.focusedId === WHOLESALE
        ? t('softkeys.select')
        : stage === 'ready'
          ? t('softkeys.today')
          : ''

  const stats = data?.stats
  const change = days === 7 ? stats?.change7_pct : stats?.change30_pct
  const direction = directionOf(change)
  const high = days === 7 ? stats?.high7_per_kg : stats?.high30_per_kg
  const low = days === 7 ? stats?.low7_per_kg : stats?.low30_per_kg

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
        {stage === 'loading' && <LoadingState areaName={detail.areaName} />}
        {stage === 'failed' && <FailedState />}
        {noRetail && <NoRetailState reason={noRetail} />}
        {data && !noRetail && (
          <div className={styles.stack}>
            <div className={styles.box}>
              <div className={styles.sumrow}>
                <span className={styles.summary}>
                  <b>{t('detail.trend.title', { days })}</b>
                  {direction && !empty && <Pill kind={direction} text={fmt.percent(change)} />}
                </span>
                <span className={styles.range}>
                  <KeyCap>#</KeyCap>
                  <span className={cx(styles.option, days === 7 && styles.current)}>
                    {t('hints.d7')}
                  </span>
                  <span className={cx(styles.option, days === 30 && styles.current)}>
                    {t('hints.d30')}
                  </span>
                </span>
              </div>
              {empty ? (
                // No price in the range: no line is drawn and nothing is filled in (docs/02 §6).
                <StatusBox title={MISSING} lines={[t('freshness.none')]} />
              ) : (
                <TrendChart
                  points={points}
                  tone={toneOf(detail.crop?.category)}
                  formatValue={fmt.price}
                  closedLabel={t('detail.trend.closedShort')}
                />
              )}
            </div>
            {!empty && (
              <MetricGrid
                tone={toneOf(detail.crop?.category)}
                items={[
                  { label: t('detail.stats.high'), value: fmt.price(high) },
                  { label: t('detail.stats.low'), value: fmt.price(low) },
                  {
                    label: t('detail.stats.volatility.label'),
                    value: stats?.volatility
                      ? t(`detail.stats.volatility.${stats.volatility}`)
                      : MISSING,
                  },
                ]}
              />
            )}
          </div>
        )}
      </div>
    </DetailFrame>
  )
}
