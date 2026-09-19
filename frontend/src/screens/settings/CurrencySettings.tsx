import { useRef } from 'react'

import { useNav } from '@/app/navigation'
import { Card, CardList } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import {
  currencySymbol,
  DISPLAY_CURRENCIES,
  LOCAL,
  type CurrencyCode,
  type DisplayCurrency,
} from '@/lib/money'
import { useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './settings.module.css'

/**
 * Settings → 顯示幣別 (F19, docs/02 §5.7): each country's own currency (the default), or one
 * currency for every country, so prices can be read side by side. The chosen one has a check
 * mark; choosing one saves it and goes back. Prices are only shown converted — what the API
 * sends and what is stored stays in the local currency.
 */
export function CurrencySettings() {
  const { t } = useText()
  const nav = useNav()
  const chosen = useSettings((s) => s.displayCurrency)
  const chooseDisplayCurrency = useSettings((s) => s.chooseDisplayCurrency)
  const root = useRef<HTMLDivElement>(null)

  const list = useFocusList([...DISPLAY_CURRENCIES], {
    root,
    onActivate: (id) => {
      chooseDisplayCurrency(id as DisplayCurrency)
      nav.back()
    },
  })
  useKeys(list.keys)

  return (
    <Shell
      title={t('settings.rows.currency')}
      softKeys={{ center: t('softkeys.select'), right: t('softkeys.back') }}
    >
      <div ref={root}>
        <CardList>
          {DISPLAY_CURRENCIES.map((currency, i) => (
            <Card
              key={currency}
              focusId={currency}
              lead={
                <Tile keyCap={i + 1}>
                  {currency === LOCAL ? (
                    <UiIcon name="globe" />
                  ) : (
                    <span>{currencySymbol(currency)}</span>
                  )}
                </Tile>
              }
              name={
                currency === LOCAL
                  ? t('currency.local')
                  : t(`currency.names.${currency as CurrencyCode}`)
              }
              meta={currency === LOCAL ? t('currency.localNote') : currency}
              trailing={
                currency === chosen ? (
                  <span className={styles.check}>
                    <UiIcon name="check" />
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
