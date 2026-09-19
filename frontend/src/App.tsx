import { useTranslation } from 'react-i18next'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { debugRoutes } from '@/app/debugRoutes'
import { Shell } from '@/components/Shell/Shell'

// Placeholder screen until the full route table (T21) lands.
function Placeholder() {
  const { t } = useTranslation()
  return (
    <Shell title={t('app.name')} softKeys={{ left: t('softkeys.menu'), right: t('softkeys.exit') }}>
      <p style={{ padding: 'var(--gut)' }}>{t('setup.welcome')}</p>
    </Shell>
  )
}

const router = createBrowserRouter([...debugRoutes, { path: '*', Component: Placeholder }])

export default function App() {
  return <RouterProvider router={router} />
}
