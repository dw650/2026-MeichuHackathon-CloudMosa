import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { DETAIL_TABS, paths } from '@/app/paths'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { Note } from '@/components/Note/Note'
import { PriceTypeTag } from '@/components/PriceTypeTag/PriceTypeTag'
import { Shell, type SoftKeyLabels } from '@/components/Shell/Shell'
import { Tabs } from '@/components/Tabs/Tabs'
import { UiIcon } from '@/icons/ui'
import { describeFreshness, formatDateTime } from '@/lib/dates'
import { AreaSheet } from '@/screens/shared/AreaSheet'
import { MenuSheet } from '@/screens/shared/MenuSheet'
import { useEstimate } from '@/screens/shared/useEstimate'
import { useText } from '@/screens/shared/useText'

import styles from './CropDetailScreen.module.css'
import { type Detail, isMissing, type QuoteView } from './useDetail'

export interface DetailFrameProps {
  detail: Detail
  quote: QuoteView
  softKeys: SoftKeyLabels
  /** This tab's own panel (比價: the sort panel), shown while its `?sheet=` is open. */
  sheet?: ReactNode
  /** Another request of the tab; a crop or area that does not exist sends the user home. */
  error?: unknown
  children: ReactNode
}

/** Data time: 「9/19 11:40」 for today's data, otherwise 「昨天」「3 天前」 in the warning colour. */
function DataTime({ quote }: { quote: QuoteView }) {
  const { dates } = useText()
  const data = quote.data
  if (!data || data.staleness.state === 'none') return null
  if (data.staleness.state === 'today') return <span>{formatDateTime(data.fetched_at, dates)}</span>
  const { text } = describeFreshness(data.staleness, data.trade_date, dates)
  // Market holidays show the trade date as it is; old data is always flagged (docs/02 §5.4).
  return <span className={data.staleness.state === 'stale' ? styles.warn : undefined}>{text}</span>
}

/** Header, info bar and tabs of the crop detail screen around one tab's content. */
export function DetailFrame({ detail, quote, softKeys, sheet, error, children }: DetailFrameProps) {
  const { t, pick } = useText()
  const estimate = useEstimate()
  const { nav, tab, type } = detail
  if (isMissing(quote.error) || isMissing(error)) return <Navigate to={paths.home()} replace />

  const overlay =
    nav.sheet === 'menu' ? (
      <MenuSheet cropId={detail.cropId} areaFor="view" />
    ) : nav.sheet === 'area' ? (
      <AreaSheet areaFor="view" currentAreaId={detail.areaId} />
    ) : (
      (sheet ?? null)
    )
  const keys = overlay
    ? { left: '', center: t('softkeys.select'), right: t('softkeys.close') }
    : softKeys

  return (
    <Shell title={pick(detail.crop?.name) || t('app.name')} softKeys={keys} overlay={overlay}>
      <InfoBar
        small={<PriceTypeTag type={type} label={estimate.typeLabel(type)} />}
        left={
          <>
            <UiIcon name="pin" />
            <b>{detail.areaName}</b>
            {tab === 'today' && <KeyCap>#</KeyCap>}
          </>
        }
        right={
          <>
            <KeyCap>*</KeyCap>
            <PriceTypeTag type={type} label={estimate.typeLabel(type)} />
            <DataTime quote={quote} />
          </>
        }
      />
      <Tabs
        tabs={DETAIL_TABS.map((id) => ({ id, label: t(`detail.tabs.${id}`) }))}
        activeId={tab}
      />
      {/* Once per screen, above the tab's own content: this price is an estimate (docs/06 §3.6). */}
      <Note text={estimate.note(type, detail.cropId)} />
      {children}
    </Shell>
  )
}
