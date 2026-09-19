import { useRef } from 'react'
import { Navigate } from 'react-router'

import { useAreas, useCountries, useLocate } from '@/api/queries'
import { Card, CardList, Chevron } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import { locateGuess, RETRY_ID, setupPath, useSetupFlow } from './flow'
import { Failed, LoadingRows, StepDots } from './parts'

const YES = 'yes'
const NO = 'no'

/**
 * 「你的位置」 (docs/02 §5.1, F17): the area guessed from the network. 1 accepts it and opens home
 * with the country's default watchlist; 2 picks the country and area by hand. Without a guess
 * (none, a failed lookup or an unknown area) this entry turns into the country list.
 */
export default function LocateScreen() {
  const { t, pick, lang } = useText()
  const flow = useSetupFlow()
  const chooseCountry = useSettings((s) => s.chooseCountry)
  const chooseArea = useSettings((s) => s.chooseArea)
  const locate = useLocate()
  const guess = locateGuess(locate.data)
  const countries = useCountries()
  const areas = useAreas(guess?.country)
  const country = countries.data?.countries.find((c) => c.code === guess?.country)
  const area = areas.data?.areas.find((a) => a.id === guess?.areaId)

  const unknown =
    guess === null ||
    (countries.data !== undefined && country === undefined) ||
    (areas.data !== undefined && area === undefined)
  const noGuess = !locate.isPending && unknown
  const ready = guess !== null && country !== undefined && area !== undefined
  const failed =
    !ready && ((countries.isError && !countries.isFetching) || (areas.isError && !areas.isFetching))
  const ids = ready ? [YES, NO] : failed ? [RETRY_ID] : []

  const retry = () => {
    if (countries.isError) void countries.refetch()
    if (areas.isError) void areas.refetch()
  }
  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(ids, {
    root,
    onActivate: (id) => {
      if (id === RETRY_ID) retry()
      else if (id === NO) flow.next('country')
      else if (id === YES && guess && country) {
        chooseCountry(guess.country, country)
        chooseArea(guess.areaId)
        flow.finish()
      }
    },
  })
  useKeys(list.keys)

  if (noGuess) return <Navigate to={setupPath('country', flow.depth)} replace />

  const center = ready ? t('softkeys.select') : failed ? t('softkeys.retry') : ''
  return (
    <Shell title={t('setup.locate.title')} softKeys={{ center, right: t('softkeys.back') }}>
      <div ref={root}>
        <StepDots step={2} />
        {ready ? (
          <>
            <StatusBox
              icon="pin"
              title={t('setup.locate.question', { area: areaLabel(area, country, lang) })}
              details={[`${pick(area.region)} · ${pick(country.name)}`, t('setup.locate.how')]}
            />
            <CardList>
              <Card
                focusId={YES}
                compact
                lead={
                  <Tile tone="green" keyCap={1}>
                    <UiIcon name="check" />
                  </Tile>
                }
                name={t('setup.locate.yes')}
                trailing={<Chevron />}
              />
              <Card
                focusId={NO}
                compact
                lead={
                  <Tile keyCap={2}>
                    <UiIcon name="grid" />
                  </Tile>
                }
                name={t('setup.locate.no')}
                trailing={<Chevron />}
              />
            </CardList>
          </>
        ) : failed ? (
          <Failed />
        ) : (
          <LoadingRows rows={2} />
        )}
      </div>
    </Shell>
  )
}
