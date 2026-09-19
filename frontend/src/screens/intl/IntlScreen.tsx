import { type ReactNode, useRef } from 'react'
import { Navigate } from 'react-router'

import { errorKind } from '@/api/client'
import { type IntlItem, useIntlPrices, useRefresh } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths } from '@/app/paths'
import { Card, CardList } from '@/components/Card/Card'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import type { PillProps } from '@/components/Pill/Pill'
import { Shell } from '@/components/Shell/Shell'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { describeMonth } from '@/lib/monthly'
import { useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './intl.module.css'
import { Credit, FailedState, IntlInfoBar, LoadingState, OldDataCard, RETRY } from './parts'
import { type IntlFormat, useIntlFormat } from './useIntlFormat'

/** Digit key caps go on the first nine cards (docs/02 §4); there are six series. */
const DIGIT_KEYS = 9
const PREFIX = 'series:'

const seriesFocusId = (id: string) => PREFIX + id

/**
 * 國際參考價 (bonus B5, docs/02 §3.2): the World Bank Pink Sheet series, each with its latest
 * month, the price per kg in the country's currency (converted with the latest daily rate, whose
 * date the info bar shows) and the change from the month before. Opened from the left soft key
 * menu; OK or 1–6 opens a series, the right soft key goes back. No menu, `*` or `#` here.
 */
export default function IntlScreen() {
  const { t } = useText()
  const country = useSettings((s) => s.country)
  const query = useIntlPrices(country)
  const refresh = useRefresh()
  const nav = useNav()
  const fmt = useIntlFormat()
  const root = useRef<HTMLDivElement>(null)

  const data = query.data
  const stage = data ? 'ready' : query.error ? 'failed' : 'loading'
  const old = stage === 'ready' && query.error !== null
  const items = data?.items ?? []
  const ids = [
    ...(stage === 'failed' || old ? [RETRY] : []),
    ...items.map((item) => seriesFocusId(item.id)),
  ]
  const list = useFocusList(ids, {
    root,
    digitOffset: old ? 1 : 0,
    onActivate: (id) => {
      if (id === RETRY) void refresh()
      else nav.open(paths.intlSeries(id.slice(PREFIX.length)))
    },
  })
  useKeys(list.keys)

  // A country that no longer exists: the settings are out of date, start again at home.
  if (query.error && !data && errorKind(query.error) !== 'unavailable') {
    return <Navigate to={paths.home()} replace />
  }

  const center =
    list.focusedId === RETRY ? t('softkeys.retry') : list.focusedId ? t('softkeys.view') : ''
  return (
    <Shell title={t('intl.title')} softKeys={{ center, right: t('softkeys.back') }}>
      <IntlInfoBar fx={data?.fx} fmt={fmt} />
      <div ref={root}>
        {stage === 'loading' && <LoadingState />}
        {stage === 'failed' && <FailedState />}
        {data && (
          <>
            <p className={styles.note}>
              <span>{t('intl.note')}</span>
              <Credit />
            </p>
            <CardList>
              {old && <OldDataCard />}
              {items.map((item, index) => (
                <SeriesCard
                  key={item.id}
                  item={item}
                  index={index}
                  today={data.today}
                  old={old}
                  fmt={fmt}
                />
              ))}
            </CardList>
          </>
        )}
      </div>
    </Shell>
  )
}

interface SeriesCardProps {
  item: IntlItem
  index: number
  today: string
  old: boolean
  fmt: IntlFormat
}

/** Tile with its number key, name, month and grade, local price and the monthly change. */
function SeriesCard({ item, index, today, old, fmt }: SeriesCardProps) {
  const { t, pick } = useText()
  const month = describeMonth(item.month, today, fmt.months)
  let meta: ReactNode
  if (item.price_per_kg === null) {
    meta = t(item.reason === 'no_fx' ? 'intl.noRate' : 'intl.noData')
  } else {
    // The month first: a long grade may be cut off, the month never is.
    meta = (
      <>
        <span className={month.warn ? styles.warn : undefined}>{month.text}</span> ·{' '}
        {pick(item.spec)}
      </>
    )
  }
  let pill: Omit<PillProps, 'glyphOnlyWhenSmall'> | undefined
  if (old) pill = { kind: 'old', text: t('freshness.old') }
  else if (item.change) pill = { kind: item.change.direction, text: fmt.percent(item.change.pct) }
  return (
    <Card
      focusId={seriesFocusId(item.id)}
      lead={
        <CropIcon
          crop={item.icon}
          category={item.category}
          keyCap={index < DIGIT_KEYS ? index + 1 : undefined}
        />
      }
      name={pick(item.name)}
      meta={meta}
      price={item.price_per_kg === null ? null : fmt.price(item.price_per_kg)}
      pill={pill}
    />
  )
}
