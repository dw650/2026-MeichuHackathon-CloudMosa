import { useRef } from 'react'

import { type CompareRow, useCompare } from '@/api/queries'
import { paths } from '@/app/paths'
import { Card, CardList } from '@/components/Card/Card'
import { Note } from '@/components/Note/Note'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { describeFreshness } from '@/lib/dates'
import { MISSING } from '@/lib/format'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useEstimate } from '@/screens/shared/useEstimate'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { useText } from '@/screens/shared/useText'

import { SORT_LABEL, sortRows } from './compareRows'
import styles from './CropDetailScreen.module.css'
import { DetailFrame } from './DetailFrame'
import { SortSheet } from './SortSheet'
import { FailedState, LoadingState, StaleDataCard } from './states'
import { DEFAULT_SORT, type Detail, RETRY, stageOf, useDetailQuote } from './useDetail'

const PREFIX = 'area:'

interface RowProps {
  row: CompareRow
  detail: Detail
}

/** One area: its price rank, name, distance · markets · freshness, price and gap to the viewed area. */
function AreaCard({ row, detail }: RowProps) {
  const { t, pick, dates } = useText()
  const fmt = usePriceFormat()
  const catalog = useCountryData()
  const area = catalog.area(row.area_id)
  const missing = row.price_per_kg === null
  const freshness = describeFreshness(row.staleness, row.trade_date, dates)
  const parts = missing
    ? [t(detail.type === 'retail' ? 'states.noRetail' : 'freshness.none')]
    : [
        row.is_base ? '' : t('common.distance', { km: row.distance_km }),
        detail.type === 'wholesale'
          ? t('detail.compare.marketCount', { count: row.n_markets })
          : '',
      ].filter(Boolean)
  const diff = row.diff_per_kg
  return (
    <Card
      focusId={PREFIX + row.area_id}
      variant={row.is_base ? 'mine' : undefined}
      lead={<Tile round>{row.rank ?? MISSING}</Tile>}
      name={
        <>
          {pick(area?.name) || row.area_id}
          <span className={styles.suffix}>{pick(catalog.country?.area_suffix)}</span>
        </>
      }
      meta={
        <>
          {parts.join(' · ')}
          {!missing && freshness.text && (
            <>
              {parts.length > 0 && ' · '}
              <span className={freshness.warn ? styles.warn : undefined}>{freshness.text}</span>
            </>
          )}
        </>
      }
      price={missing ? null : fmt.price(row.price_per_kg)}
      pill={
        row.is_base
          ? { kind: 'you', text: t('detail.compare.you') }
          : diff === null
            ? undefined
            : { kind: fmt.diffDirection(diff) ?? 'flat', text: fmt.diff(diff) }
      }
    />
  )
}

/** 比價 (T29): every area of the country, the viewed one marked 「你」. */
export function CompareTab({ detail }: { detail: Detail }) {
  const { t } = useText()
  const estimate = useEstimate()
  const { nav, sort } = detail
  const quote = useDetailQuote(detail)
  const { country, areaId, cropId, type } = detail
  const compare = useCompare(
    country && areaId ? { country, area: areaId, crop: cropId, type } : null,
  )
  // Another area's or price type's rows are never shown while these load.
  const data = compare.isPlaceholderData ? undefined : compare.data
  const stage = stageOf(data, compare.error)
  const rows = data ? sortRows(data.rows, sort) : []
  const oldData = stage === 'ready' && compare.error !== null
  const ids = [
    ...(oldData || stage === 'failed' ? [RETRY] : []),
    ...rows.map((row) => PREFIX + row.area_id),
  ]

  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(ids, {
    root,
    digitOffset: oldData ? 1 : 0,
    active: !nav.sheet,
    onActivate: (id) => {
      if (id === RETRY) quote.refresh()
      else nav.open(paths.crop(cropId, 'today', id.slice(PREFIX.length)))
    },
  })
  useKeys({ ...list.keys, ...detail.keys, onHash: () => nav.openSheet('sort') })

  const center =
    list.focusedId === RETRY ? t('softkeys.retry') : list.focusedId ? t('softkeys.view') : ''
  const rank = data?.rank

  return (
    <DetailFrame
      detail={detail}
      quote={quote}
      error={compare.error}
      softKeys={{ left: t('softkeys.menu'), center, right: t('softkeys.back') }}
      sheet={
        nav.sheet === 'sort' && (
          <SortSheet
            nav={nav}
            current={sort}
            urlFor={(to) => detail.urlWith('sort', to === DEFAULT_SORT ? undefined : to)}
          />
        )
      }
    >
      <div className={styles.sortbar}>
        <UiIcon name="sort" />
        <KeyCap>#</KeyCap>
        <b>{t(`detail.compare.sorts.${SORT_LABEL[sort]}`)}</b>
      </div>
      <div ref={root}>
        {stage === 'ready' && rank && (
          <div className={styles.rankline}>
            {rank.position === null
              ? t('detail.compare.rankNone', { area: detail.areaName })
              : t('detail.compare.rank', {
                  area: detail.areaName,
                  rank: rank.position,
                  total: rank.total,
                })}
          </div>
        )}
        {stage === 'ready' && <Note text={estimate.note(detail.type, detail.cropId)} />}
        {stage === 'loading' && <LoadingState areaName={detail.areaName} />}
        {stage === 'failed' && <FailedState />}
        {stage === 'ready' && (
          <CardList>
            {oldData && <StaleDataCard fetchedAt={quote.data?.fetched_at ?? null} />}
            {rows.map((row) => (
              <AreaCard key={row.area_id} row={row} detail={detail} />
            ))}
          </CardList>
        )}
      </div>
    </DetailFrame>
  )
}
