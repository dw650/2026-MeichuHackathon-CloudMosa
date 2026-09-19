// States shared by the detail tabs (F12, docs/02 §6): loading, connection failed, no retail.

import { Card, CardList, Chevron } from '@/components/Card/Card'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import type { UiIconName } from '@/icons/names'
import { UiIcon } from '@/icons/ui'
import { formatTime } from '@/lib/dates'
import { useText } from '@/screens/shared/useText'

import { type NoRetailReason, RETRY, WHOLESALE } from './useDetail'

/** Static skeleton cards and 「正在取得 {地區} 的行情」 (no animation). */
export function LoadingState({ areaName }: { areaName: string }) {
  const { t } = useText()
  return (
    <>
      <StatusBox
        icon="refresh"
        title={t('states.loading', { area: areaName })}
        lines={[t('states.loadingNote')]}
      />
      <CardList>
        <Card name={<Skeleton width={70} />} loading />
        <Card name={<Skeleton width={50} />} loading />
      </CardList>
    </>
  )
}

export interface ExitCardProps {
  focusId: string
  icon: UiIconName
  label: string
  /** Digit that opens it, drawn on the tile (1 看其他地區, 2 看走勢). */
  keyCap?: number
}

/** A card that leads out of an empty or failed state. */
export function ExitCard({ focusId, icon, label, keyCap }: ExitCardProps) {
  return (
    <Card
      focusId={focusId}
      lead={
        <Tile keyCap={keyCap}>
          <UiIcon name={icon} />
        </Tile>
      }
      name={label}
      trailing={<Chevron />}
    />
  )
}

/** Nothing to show and the request failed: explanation and the 重試 exit. */
export function FailedState() {
  const { t } = useText()
  return (
    <>
      <StatusBox icon="alert" title={t('states.error')} lines={[t('states.settingsKept')]} />
      <CardList>
        <ExitCard focusId={RETRY} icon="refresh" label={t('states.retry')} />
      </CardList>
    </>
  )
}

/** Old data stays on screen after a failed refresh; this card says so and retries on OK. */
export function StaleDataCard({ fetchedAt }: { fetchedAt: string | null }) {
  const { t } = useText()
  return (
    <Card
      focusId={RETRY}
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

/** 尚無零售資料 with its reason and the 看批發 exit. */
export function NoRetailState({ reason }: { reason: NoRetailReason }) {
  const { t } = useText()
  return (
    <>
      <StatusBox
        icon="scale"
        title={t('states.noRetail')}
        details={[t(reason === 'no_retail_crop' ? 'states.noRetailCrop' : 'states.retailNote')]}
      />
      <CardList>
        <ExitCard focusId={WHOLESALE} icon="scale" label={t('priceType.switchTo.wholesale')} />
      </CardList>
    </>
  )
}
