// States shared by the two market screens (docs/02 §6). Retry cards use the focus id `retry`.

import { Card, CardList } from '@/components/Card/Card'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { UiIcon } from '@/icons/ui'
import { useText } from '@/screens/shared/useText'

/** 「正在取得 {地區} 的行情…」 under the static skeleton while the first data loads. */
export function LoadingNote({ area }: { area: string }) {
  const { t } = useText()
  return <StatusBox lines={[`${t('states.loading', { area })}…`, t('states.loadingNote')]} />
}

/** The request failed and there is nothing to show: the reason and the 重試 exit. */
export function Failed() {
  const { t } = useText()
  return (
    <>
      <StatusBox icon="alert" title={t('states.error')} lines={[t('states.settingsKept')]} />
      <CardList>
        <Card
          focusId="retry"
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

/** A refresh failed: the old data stays below this warning card, which retries on OK. */
export function OldDataCard({ since }: { since: string }) {
  const { t } = useText()
  return (
    <CardList>
      <Card
        focusId="retry"
        variant="alert"
        lead={
          <Tile>
            <UiIcon name="alert" />
          </Tile>
        }
        name={t('states.error')}
        meta={t('states.showingOld', { time: since })}
      />
    </CardList>
  )
}
