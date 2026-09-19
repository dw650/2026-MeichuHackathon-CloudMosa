import { useRef } from 'react'
import { useNavigate } from 'react-router'

import { Card, CardList } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { useText } from '@/screens/shared/useText'

/**
 * Every screen's error boundary (docs/04 §8): a crash in one screen shows this instead of a
 * blank page, and OK goes home (the settings are untouched).
 */
export function ScreenError() {
  const { t } = useText()
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(['home'], {
    root,
    onActivate: () => void navigate('/', { replace: true }),
  })
  useKeys(list.keys)
  return (
    <Shell
      title={t('app.name')}
      softKeys={{ center: t('softkeys.open'), right: t('softkeys.back') }}
    >
      <div ref={root}>
        <StatusBox
          icon="alert"
          title={t('errors.screen.title')}
          lines={[t('errors.screen.note')]}
        />
        <CardList>
          <Card focusId="home" name={t('errors.screen.home')} />
        </CardList>
      </div>
    </Shell>
  )
}
