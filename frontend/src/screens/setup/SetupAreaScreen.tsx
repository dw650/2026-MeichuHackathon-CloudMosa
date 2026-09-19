import { useRef } from 'react'
import { Navigate } from 'react-router'

import { useAreas, useCountries } from '@/api/queries'
import { Card, CardList } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { describeFreshness } from '@/lib/dates'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import { RETRY_ID, setupAreaOrder, setupPath, useSetupFlow } from './flow'
import { AreaFreshness, Failed, LoadingRows, StepDots } from './parts'

/**
 * 「你的地區」, the last setup step (docs/02 §5.1): the chosen country's areas, its default area
 * first and the rest nearest first. Choosing one makes it my area and opens home.
 */
export default function SetupAreaScreen() {
  const { t, pick, lang, dates } = useText()
  const flow = useSetupFlow()
  const code = useSettings((s) => s.country)
  const chooseArea = useSettings((s) => s.chooseArea)
  const countries = useCountries()
  const areas = useAreas(code)
  const country = countries.data?.countries.find((c) => c.code === code)
  const rows =
    country && areas.data ? setupAreaOrder(areas.data.areas, country.default_area_id) : []
  const failed =
    rows.length === 0 &&
    ((countries.isError && !countries.isFetching) || (areas.isError && !areas.isFetching))
  const ids = failed ? [RETRY_ID] : rows.map((row) => row.area.id)

  const root = useRef<HTMLDivElement>(null)
  const focus = useFocusList(ids, {
    root,
    onActivate: (id) => {
      if (id === RETRY_ID) {
        if (countries.isError) void countries.refetch()
        if (areas.isError) void areas.refetch()
        return
      }
      chooseArea(id)
      flow.finish()
    },
  })
  useKeys(focus.keys)

  // Reached without a country (a reload, a link): choose one first, in this same entry.
  if (code === null) return <Navigate to={setupPath('country', flow.depth)} replace />

  const center = failed ? t('softkeys.retry') : ids.length ? t('softkeys.select') : ''
  return (
    <Shell title={t('setup.area.title')} softKeys={{ center, right: t('softkeys.back') }}>
      <div ref={root}>
        <StepDots step={3} />
        {failed ? (
          <Failed />
        ) : rows.length ? (
          <CardList>
            {rows.map(({ area, km }, i) => {
              const freshness = describeFreshness(area.staleness, area.latest_trade_date, dates)
              const none = area.staleness.state === 'none'
              const distance = km > 0 ? t('common.distance', { km }) : ''
              return (
                <Card
                  key={area.id}
                  focusId={area.id}
                  lead={
                    <Tile
                      tone={none ? 'slate' : freshness.warn ? 'amber' : 'green'}
                      keyCap={i < 9 ? i + 1 : undefined}
                    >
                      <UiIcon name="pin" />
                    </Tile>
                  }
                  name={areaLabel(area, country, lang)}
                  meta={[pick(area.region), distance].filter(Boolean).join(' · ')}
                  trailing={<AreaFreshness freshness={freshness} none={none} />}
                />
              )
            })}
          </CardList>
        ) : (
          <LoadingRows rows={4} />
        )}
      </div>
    </Shell>
  )
}
