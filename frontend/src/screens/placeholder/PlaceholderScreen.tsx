import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { Shell } from '@/components/Shell/Shell'

/** Stand-in for a screen that its own task has not built yet. */
export function PlaceholderScreen({ name }: { name: string }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <Shell title={t('app.name')} softKeys={{ right: t('softkeys.back') }}>
      <p style={{ padding: 'var(--gut)' }}>
        {name} · {pathname}
      </p>
    </Shell>
  )
}
