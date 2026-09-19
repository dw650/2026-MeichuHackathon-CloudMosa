import { useRef } from 'react'

import { type Country, useCountries } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { Card, CardList } from '@/components/Card/Card'
import type { Tone } from '@/components/categories'
import { Shell } from '@/components/Shell/Shell'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { useText } from '@/screens/shared/useText'
import { COUNTRY_CODES, type CountryCode, useSettings } from '@/store/settings'

import { isCountryCode, RETRY_ID, useSetupFlow } from './flow'
import { Failed, LoadingRows, StepDots } from './parts'

const TONE: Readonly<Record<CountryCode, Tone>> = { IN: 'orange', TW: 'red', MY: 'blue' }

/** A country from the API that the app supports. */
type Listed = Country & { code: CountryCode }

/**
 * 「選擇國家」 (docs/02 §5.1): each country with what it covers. In first-run setup it leads on
 * to the area list; opened later (「更改國家…」) it switches the country and goes back.
 */
export default function CountryScreen() {
  const { t, pick } = useText()
  const nav = useNav()
  const flow = useSetupFlow()
  const firstRun = !useSettings((s) => s.setupDone)
  const chooseCountry = useSettings((s) => s.chooseCountry)
  const countries = useCountries()
  const list = (countries.data?.countries ?? []).filter((c): c is Listed => isCountryCode(c.code))
  const failed = !countries.data && countries.isError && !countries.isFetching
  const ids = failed ? [RETRY_ID] : list.map((c) => c.code)

  const root = useRef<HTMLDivElement>(null)
  const focus = useFocusList(ids, {
    root,
    onActivate: (id) => {
      if (id === RETRY_ID) {
        void countries.refetch()
        return
      }
      const country = list.find((c) => c.code === id)
      if (!country) return
      // The API country carries the defaults: area, recent areas and watchlist.
      chooseCountry(country.code, country)
      if (firstRun) flow.next('area')
      else nav.back()
    },
  })
  useKeys(focus.keys)

  const center = failed ? t('softkeys.retry') : ids.length ? t('softkeys.select') : ''
  return (
    <Shell title={t('setup.country.title')} softKeys={{ center, right: t('softkeys.back') }}>
      <div ref={root}>
        {firstRun && <StepDots step={2} />}
        {failed ? (
          <Failed />
        ) : countries.data ? (
          <CardList>
            {list.map((country, i) => (
              <Card
                key={country.code}
                focusId={country.code}
                lead={
                  <Tile tone={TONE[country.code]} keyCap={i + 1}>
                    <UiIcon name="globe" />
                  </Tile>
                }
                name={pick(country.name)}
                meta={pick(country.coverage)}
              />
            ))}
          </CardList>
        ) : (
          <LoadingRows rows={COUNTRY_CODES.length} />
        )}
      </div>
    </Shell>
  )
}
