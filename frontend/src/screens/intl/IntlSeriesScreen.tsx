import { useRef } from 'react'
import { Navigate, useParams } from 'react-router'

import { errorKind } from '@/api/client'
import { type IntlSeries, useIntlSeries, useRefresh } from '@/api/queries'
import { paths } from '@/app/paths'
import { CardList } from '@/components/Card/Card'
import { toneOf } from '@/components/categories'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import { cx } from '@/components/cx'
import { MetricGrid } from '@/components/MetricGrid/MetricGrid'
import { Pill } from '@/components/Pill/Pill'
import { Shell } from '@/components/Shell/Shell'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { TrendChart, type TrendPoint } from '@/components/TrendChart/TrendChart'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { directionOf } from '@/lib/change'
import { MISSING } from '@/lib/format'
import { describeMonth, formatDay, monthName } from '@/lib/monthly'
import { useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './intl.module.css'
import { Credit, FailedState, IntlInfoBar, LoadingState, OldDataCard, RETRY } from './parts'
import { type IntlFormat, useIntlFormat } from './useIntlFormat'

const NO_ITEMS: readonly string[] = []

/**
 * One international series (bonus B5): the latest month's price per kg in the country's
 * currency with its change, the 12-month trend with its high, low and average, then the
 * published US dollar price, the rate used and the sources. Nothing to select: ↑ ↓ scroll the
 * page (docs/03 §5); the right soft key goes back to the list.
 */
export default function IntlSeriesScreen() {
  const { seriesId = '' } = useParams()
  const { t, pick } = useText()
  const country = useSettings((s) => s.country)
  const query = useIntlSeries(country, seriesId)
  const refresh = useRefresh()
  const fmt = useIntlFormat()
  const root = useRef<HTMLDivElement>(null)

  const data = query.data
  const stage = data ? 'ready' : query.error ? 'failed' : 'loading'
  const old = stage === 'ready' && query.error !== null
  const list = useFocusList(stage === 'failed' || old ? [RETRY] : NO_ITEMS, {
    root,
    onActivate: () => void refresh(),
  })
  useKeys(list.keys)

  // An unknown series (an old link): back to the list rather than an empty page.
  if (query.error && !data && errorKind(query.error) !== 'unavailable') {
    return <Navigate to={paths.intl()} replace />
  }

  return (
    <Shell
      title={pick(data?.name) || t('intl.title')}
      softKeys={{
        center: list.focusedId === RETRY ? t('softkeys.retry') : '',
        right: t('softkeys.back'),
      }}
    >
      <IntlInfoBar fx={data?.fx} fmt={fmt} />
      <div ref={root}>
        {stage === 'loading' && <LoadingState />}
        {stage === 'failed' && <FailedState />}
        {old && (
          <CardList>
            <OldDataCard />
          </CardList>
        )}
        {data && (
          <div className={styles.stack}>
            <Hero data={data} fmt={fmt} />
            <Trend data={data} fmt={fmt} />
            {data.price_per_kg !== null && (
              <MetricGrid
                tone={toneOf(data.category)}
                items={[
                  { label: t('intl.high'), value: fmt.price(data.stats.high_per_kg) },
                  { label: t('intl.low'), value: fmt.price(data.stats.low_per_kg) },
                  {
                    label: t('intl.vsAverage'),
                    value: fmt.signedPercent(data.stats.vs_avg_pct),
                    direction: directionOf(data.stats.vs_avg_pct) ?? undefined,
                  },
                ]}
              />
            )}
            <Facts data={data} fmt={fmt} />
          </div>
        )}
      </div>
    </Shell>
  )
}

interface PartProps {
  data: IntlSeries
  fmt: IntlFormat
}

/** Why there is no local price. */
function useReason(data: IntlSeries): string {
  const { t } = useText()
  return t(data.reason === 'no_fx' ? 'intl.noRate' : 'intl.noData')
}

/** Grade, the latest month's price, its change and 「2026 年 8 月均價」 (flagged when old). */
function Hero({ data, fmt }: PartProps) {
  const { t, pick } = useText()
  const reason = useReason(data)
  const month = describeMonth(data.month, data.today, fmt.months, { withYear: true })
  const missing = data.price_per_kg === null
  return (
    <div className={cx(styles.box, styles.hero)}>
      <span className={styles.heroTile}>
        <CropIcon crop={data.icon} category={data.category} />
      </span>
      <div className={styles.heroBody}>
        <div className={styles.label}>{pick(data.spec)}</div>
        <div className={styles.big}>{fmt.price(data.price_per_kg)}</div>
        {!missing && data.change && (
          <div className={styles.change}>
            <Pill kind={data.change.direction} text={fmt.percent(data.change.pct)} />
            <b>{fmt.diff(data.change.diff_per_kg)}</b>
            <span className={styles.vsPrev}>{t('intl.vsPrevMonth')}</span>
          </div>
        )}
        <div className={cx(styles.month, month.warn && styles.warn)}>
          {missing ? reason : t('intl.monthAverage', { month: month.text })}
        </div>
      </div>
    </div>
  )
}

/** The 12 months up to the latest one; months without a price break the line. */
function Trend({ data, fmt }: PartProps) {
  const { t } = useText()
  const reason = useReason(data)
  const points = data.series.map((point): TrendPoint => ({
    value: point.price_per_kg,
    label: monthName(point.month, fmt.months),
  }))
  const empty = points.every((point) => point.value === null)
  return (
    <div className={styles.box}>
      <b className={styles.title}>{t('intl.trend')}</b>
      {empty ? (
        // Nothing to draw: no line, nothing filled in (docs/02 §6).
        <StatusBox title={MISSING} lines={[reason]} />
      ) : (
        <TrendChart
          points={points}
          tone={toneOf(data.category)}
          formatValue={fmt.price}
          closedLabel=""
        />
      )}
    </div>
  )
}

/** Published price, the series as the World Bank names it, the rate used and the sources. */
function Facts({ data, fmt }: PartProps) {
  const { t } = useText()
  const published = data.published ? formatDay(data.published, fmt.months) : null
  return (
    <div className={cx(styles.box, styles.facts)}>
      <span>{t('intl.published', { price: fmt.usd(data.usd, data.usd_unit) })}</span>
      <span>{t('intl.series', { name: data.source_name })}</span>
      <span>
        {data.fx
          ? t('intl.rateLine', {
              date: formatDay(data.fx.rate_date, fmt.months),
              rate: fmt.rate(data.fx.per_usd, data.fx.currency),
            })
          : t('intl.noRate')}
      </span>
      <span>{published ? t('intl.source', { date: published }) : t('intl.sourceUndated')}</span>
      <Credit />
    </div>
  )
}
