import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

import { DEMO_STALE_DAYS } from '@/app/demoHeaders'
import { Card, CardList } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { useCountryData } from '@/screens/shared/useCountryData'
import { areaLabel, useText } from '@/screens/shared/useText'
import { type DemoLocate, type DemoSwitches, useSettings } from '@/store/settings'

import styles from './settings.module.css'

/** The order OK steps through the location guesses. */
const LOCATE_CYCLE: readonly DemoLocate[] = ['auto', 'IN:nashik', 'TW:taipei', 'none']
/** i18n key of each guess (`:` is i18next's namespace separator, so not the id itself). */
const LOCATE_LABEL = {
  auto: 'auto',
  'IN:nashik': 'nashik',
  'TW:taipei': 'taipei',
  none: 'none',
} as const satisfies Record<DemoLocate, string>

interface Row {
  id: keyof DemoSwitches
  name: string
  meta: string
  value: string
  run(): void
}

/**
 * Settings → Demo (F18, docs/04 §6.2; demo builds only): OK flips 模擬 API 失敗 and
 * 模擬地區未更新, and steps 模擬推測位置 through auto / India Nashik / Taiwan Taipei / no guess.
 * The api client sends them as request headers; answers fetched with the old switches are
 * marked stale, so every screen fetches again when it shows next.
 */
export function DemoSettings() {
  const { t, lang } = useText()
  const { country, myArea } = useCountryData()
  const demo = useSettings((s) => s.demo)
  const setDemo = useSettings((s) => s.setDemo)
  const client = useQueryClient()
  const root = useRef<HTMLDivElement>(null)

  const change = (switches: Partial<DemoSwitches>) => {
    setDemo(switches)
    void client.invalidateQueries()
  }
  const onOff = (on: boolean) => t(on ? 'settings.demo.on' : 'settings.demo.off')
  const nextLocate =
    LOCATE_CYCLE[(LOCATE_CYCLE.indexOf(demo.locate) + 1) % LOCATE_CYCLE.length] ?? 'auto'

  const rows: Row[] = [
    {
      id: 'fail',
      name: t('settings.demo.fail'),
      meta: t('settings.demo.failNote'),
      value: onOff(demo.fail),
      run: () => change({ fail: !demo.fail }),
    },
    {
      id: 'stale',
      name: t('settings.demo.stale'),
      meta: t('settings.demo.staleNote', {
        area: areaLabel(myArea, country, lang),
        days: DEMO_STALE_DAYS,
      }),
      value: onOff(demo.stale),
      run: () => change({ stale: !demo.stale }),
    },
    {
      id: 'locate',
      name: t('settings.demo.locate'),
      meta: t('settings.demo.locateNote'),
      value: t(`settings.demo.locations.${LOCATE_LABEL[demo.locate]}`),
      run: () => change({ locate: nextLocate }),
    },
  ]

  const list = useFocusList(
    rows.map((row) => row.id),
    { root, onActivate: (id) => rows.find((row) => row.id === id)?.run() },
  )
  // The rows carry no number key caps, so the digit keys do nothing here.
  useKeys({ ...list.keys, onDigit: undefined })

  return (
    <Shell
      title={t('settings.demo.title')}
      softKeys={{ center: t('softkeys.toggle'), right: t('softkeys.back') }}
    >
      <div ref={root}>
        <CardList>
          {rows.map((row) => (
            <Card
              key={row.id}
              focusId={row.id}
              name={row.name}
              meta={row.meta}
              trailing={<span className={styles.value}>{row.value}</span>}
            />
          ))}
        </CardList>
      </div>
    </Shell>
  )
}
