// Parts shared by the two international price screens (bonus B5): the info bar with the unit
// and the rate date, the source credit, and the loading and connection-failed states.

import { Card, CardList, Chevron } from '@/components/Card/Card'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { UiIcon } from '@/icons/ui'
import { formatDay } from '@/lib/monthly'
import { useText } from '@/screens/shared/useText'

import styles from './intl.module.css'
import type { IntlFormat } from './useIntlFormat'

/** Focus id of the retry exit (connection failed, or old data on screen). */
export const RETRY = 'retry'

interface Fx {
  rate_date: string
}

/** 「元/公斤」 on the left; 「以 9/19 匯率換算」 on the right (「9/19 匯率」 on 128×160). */
export function IntlInfoBar({ fx, fmt }: { fx: Fx | null | undefined; fmt: IntlFormat }) {
  const { t } = useText()
  const date = fx ? formatDay(fx.rate_date, fmt.months) : null
  return (
    <InfoBar
      left={
        <>
          <UiIcon name="globe" />
          <b>{fmt.unitLabel}</b>
        </>
      }
      right={date ? <span>{t('intl.rateDate', { date })}</span> : undefined}
      small={date ? <span>{t('intl.rateShort', { date })}</span> : undefined}
    />
  )
}

/** The exchange rate credit the provider asks for on every page that uses its rates. */
export function Credit() {
  const { t } = useText()
  return <span className={styles.credit}>{t('intl.credit')}</span>
}

/** Static skeleton cards under 「正在取得國際參考價」 (no animation). */
export function LoadingState() {
  const { t } = useText()
  return (
    <>
      <StatusBox icon="globe" title={t('intl.loading')} lines={[t('states.loadingNote')]} />
      <CardList>
        <Card name={<Skeleton width={70} />} loading />
        <Card name={<Skeleton width={50} />} loading />
      </CardList>
    </>
  )
}

/** Nothing to show and the request failed: the error and the 重試 exit. */
export function FailedState() {
  const { t } = useText()
  return (
    <>
      <StatusBox icon="alert" title={t('states.error')} lines={[t('states.settingsKept')]} />
      <CardList>
        <Card
          focusId={RETRY}
          lead={
            <Tile>
              <UiIcon name="refresh" />
            </Tile>
          }
          name={t('states.retry')}
          trailing={<Chevron />}
        />
      </CardList>
    </>
  )
}

/** A refresh failed but the earlier prices are still on screen: says so; OK retries. */
export function OldDataCard() {
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
      meta={t('intl.showingOld')}
    />
  )
}
