import { useRef } from 'react'

import type { PriceType } from '@/api/queries'
import { IS_DEMO_BUILD } from '@/app/flags'
import { useNav } from '@/app/navigation'
import { paths } from '@/app/paths'
import { Card, CardList } from '@/components/Card/Card'
import { cx } from '@/components/cx'
import { Shell } from '@/components/Shell/Shell'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { languageName } from '@/i18n'
import { currencySymbol, LOCAL } from '@/lib/money'
import type { UiIconName } from '@/icons/names'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { useCountryData } from '@/screens/shared/useCountryData'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './settings.module.css'

interface Row {
  id: string
  icon: UiIconName
  name: string
  /** The current value, drawn at the end of the row. */
  value: string
  /** OK changes the value on this screen, so 128×160 keeps showing it. */
  inPlace?: boolean
  run(): void
}

/**
 * 設定 (F10, docs/02 §5.7): language, country, my area, display currency, wholesale unit and
 * retail unit, each with its current value on the right; demo builds add a 「Demo」 row (F18).
 * OK (or the row's digit) opens the language, country, area or currency list, or steps a unit
 * to the country's next option.
 */
export default function SettingsScreen() {
  const { t, lang, pick } = useText()
  const nav = useNav()
  const { country, myArea } = useCountryData()
  const language = useSettings((s) => s.language)
  const currency = useSettings((s) => s.displayCurrency)
  const demo = useSettings((s) => s.demo)
  const setUnit = useSettings((s) => s.setUnit)
  const wholesale = usePriceFormat('wholesale')
  const retail = usePriceFormat('retail')
  const root = useRef<HTMLDivElement>(null)

  const nextUnit = (type: PriceType, currentId: string) => {
    const options = country?.units[type].options ?? []
    const next = options[(options.findIndex((o) => o.id === currentId) + 1) % options.length]
    if (next) setUnit(type, next.id)
  }
  const demoOn = demo.fail || demo.stale || demo.locate !== 'auto'

  const rows: Row[] = [
    {
      id: 'language',
      icon: 'globe',
      name: t('settings.rows.language'),
      value: languageName(language ?? lang),
      run: () => nav.open(paths.settingsItem('language')),
    },
    {
      id: 'country',
      icon: 'pin',
      name: t('settings.rows.country'),
      value: pick(country?.name),
      run: () => nav.open(paths.setup('country')),
    },
    {
      id: 'area',
      icon: 'store',
      name: t('settings.rows.area'),
      value: areaLabel(myArea, country, lang),
      run: () => nav.open(paths.areas('home')),
    },
    {
      id: 'currency',
      icon: 'coins',
      name: t('settings.rows.currency'),
      value: currency === LOCAL ? t('currency.localShort') : currencySymbol(currency),
      run: () => nav.open(paths.settingsItem('currency')),
    },
    {
      id: 'wholesaleUnit',
      icon: 'scale',
      name: t('settings.rows.wholesaleUnit'),
      value: wholesale.unitLabel,
      inPlace: true,
      run: () => nextUnit('wholesale', wholesale.unit.id),
    },
    {
      id: 'retailUnit',
      icon: 'scale',
      name: t('settings.rows.retailUnit'),
      value: retail.unitLabel,
      inPlace: true,
      run: () => nextUnit('retail', retail.unit.id),
    },
  ]
  if (IS_DEMO_BUILD) {
    rows.push({
      id: 'demo',
      icon: 'gear',
      name: t('settings.demo.title'),
      value: t(demoOn ? 'settings.demo.on' : 'settings.demo.off'),
      run: () => nav.open(paths.settingsItem('demo')),
    })
  }

  const list = useFocusList(
    rows.map((row) => row.id),
    { root, onActivate: (id) => rows.find((row) => row.id === id)?.run() },
  )
  useKeys(list.keys)

  return (
    <Shell
      title={t('settings.title')}
      softKeys={{ center: t('softkeys.toggle'), right: t('softkeys.back') }}
    >
      <div ref={root}>
        <CardList>
          {rows.map((row, i) => (
            <Card
              key={row.id}
              focusId={row.id}
              compact
              lead={
                <Tile keyCap={i < 9 ? i + 1 : undefined}>
                  <UiIcon name={row.icon} />
                </Tile>
              }
              name={row.name}
              trailing={
                row.value ? (
                  <span className={cx(styles.value, !row.inPlace && styles.optional)}>
                    {row.value}
                  </span>
                ) : undefined
              }
            />
          ))}
        </CardList>
      </div>
    </Shell>
  )
}
