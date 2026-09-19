import type { ReactNode } from 'react'

import type { Crop, PriceItem } from '@/api/queries'
import { Card, CardList } from '@/components/Card/Card'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import type { PillProps } from '@/components/Pill/Pill'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { Sparkline } from '@/components/Sparkline/Sparkline'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { UiIcon } from '@/icons/ui'
import { describeFreshness, type Freshness, formatTime } from '@/lib/dates'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { useText } from '@/screens/shared/useText'

import styles from './CropCards.module.css'
import { cropFocusId, RETRY_ID } from './cropList'
import type { AreaPrices } from './useAreaPrices'

/** Digit key caps go on the first nine cards (docs/02 §4). */
const DIGIT_KEYS = 9
/** Skeleton cards while loading: enough to fill the screen under the loading text. */
const SKELETON_CARDS = 4

export interface CropPriceListProps {
  crops: readonly Crop[]
  prices: AreaPrices
  /** My area's name, for 「正在取得 {地區} 的行情…」. */
  areaName: string
  /** Shown instead of the cards when there is no crop to list. */
  empty: ReactNode
}

/**
 * The crop cards of home (關注) and the crop lists with the F12 states (docs/02 §5.2, §6):
 * loading text over static skeleton cards; connection failed with nothing to show (status and
 * a retry card); or the cards, behind a connection-failed card when they are old.
 */
export function CropPriceList({ crops, prices, areaName, empty }: CropPriceListProps) {
  if (prices.status === 'loading') {
    return (
      <>
        <LoadingStatus areaName={areaName} />
        <CardList>
          <SkeletonCards crops={crops} />
        </CardList>
      </>
    )
  }
  if (prices.status === 'failed') return <FailedState />
  if (crops.length === 0) return empty
  return (
    <CardList>
      {prices.old && <OldDataCard fetchedAt={prices.fetchedAt} />}
      <CropCards crops={crops} prices={prices} />
    </CardList>
  )
}

interface CropCardsProps {
  crops: readonly Crop[]
  prices: AreaPrices
}

/** One card per crop: tile, name and variety, 7-day sparkline, price and change. */
function CropCards({ crops, prices }: CropCardsProps) {
  const format = usePriceFormat()
  const { t, pick, dates } = useText()

  const metaOf = (crop: Crop, item: PriceItem | undefined): ReactNode => {
    if (item?.price_per_kg == null) {
      return format.type === 'retail' ? t('states.noRetail') : t('freshness.none')
    }
    // Old data already carries the 舊 pill; today's data needs no label.
    const fresh = prices.old ? null : describeFreshness(item.staleness, item.trade_date, dates)
    return withFreshness(pick(crop.variety), fresh)
  }
  const pillOf = (
    item: PriceItem | undefined,
  ): Omit<PillProps, 'glyphOnlyWhenSmall'> | undefined => {
    if (prices.old) return { kind: 'old', text: t('freshness.old') }
    const change = item?.change
    return change ? { kind: change.direction, text: format.percent(change.pct) } : undefined
  }

  return crops.map((crop, index) => {
    const item = prices.item(crop.id)
    const perKg = item?.price_per_kg ?? null
    return (
      <Card
        key={crop.id}
        focusId={cropFocusId(crop.id)}
        lead={
          <CropIcon
            crop={crop.id}
            category={crop.category}
            keyCap={index < DIGIT_KEYS ? index + 1 : undefined}
          />
        }
        name={pick(crop.name)}
        meta={metaOf(crop, item)}
        spark={
          item && <Sparkline values={item.spark} direction={item.change?.direction ?? 'flat'} />
        }
        price={perKg === null ? null : format.price(perKg)}
        pill={pillOf(item)}
      />
    )
  })
}

/** 「紅洋蔥 · 昨天」: the freshness label only when the data is not from today. */
function withFreshness(variety: string, fresh: Freshness | null): ReactNode {
  if (!fresh?.text) return variety
  const label = <span className={fresh.warn ? styles.warn : undefined}>{fresh.text}</span>
  return variety ? (
    <>
      {variety} · {label}
    </>
  ) : (
    label
  )
}

function LoadingStatus({ areaName }: { areaName: string }) {
  const { t } = useText()
  return (
    <StatusBox lines={[`${t('states.loading', { area: areaName })}…`, t('states.loadingNote')]} />
  )
}

/** Static, not selectable placeholders (no blinking, docs/03 §4). */
function SkeletonCards({ crops }: { crops: readonly Crop[] }) {
  const { pick } = useText()
  if (crops.length === 0) {
    return Array.from({ length: SKELETON_CARDS - 1 }, (_, i) => (
      <Card key={i} name={<Skeleton width={64} />} loading />
    ))
  }
  return crops
    .slice(0, SKELETON_CARDS)
    .map((crop) => (
      <Card
        key={crop.id}
        lead={<CropIcon crop={crop.id} category={crop.category} />}
        name={pick(crop.name)}
        loading
      />
    ))
}

/** Nothing to show: the error with a retry exit (docs/02 §6). */
function FailedState() {
  const { t } = useText()
  return (
    <>
      <StatusBox icon="alert" title={t('states.error')} lines={[t('states.settingsKept')]} />
      <CardList>
        <Card
          focusId={RETRY_ID}
          lead={
            <Tile>
              <UiIcon name="refresh" />
            </Tile>
          }
          name={t('states.retry')}
        />
      </CardList>
    </>
  )
}

/** 「連線失敗・先顯示 09:12 的資料」 on top of the old cards; OK retries. */
function OldDataCard({ fetchedAt }: { fetchedAt: string | null }) {
  const { t } = useText()
  return (
    <Card
      focusId={RETRY_ID}
      variant="alert"
      lead={
        <Tile>
          <UiIcon name="alert" />
        </Tile>
      }
      name={t('states.error')}
      meta={t('states.showingOld', { time: formatTime(fetchedAt) })}
    />
  )
}
