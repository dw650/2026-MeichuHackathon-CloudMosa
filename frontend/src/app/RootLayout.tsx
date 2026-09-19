import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'

import { paths, withoutSheet } from './paths'

/** Wraps every route: first-run setup gate and "remember where I am" (F13). */
export function RootLayout() {
  const location = useLocation()
  const setupDone = useSettings((s) => s.setupDone)
  const rememberLocation = useSession((s) => s.rememberLocation)

  useEffect(() => {
    rememberLocation(withoutSheet(location.pathname + location.search), location.key)
  }, [location.pathname, location.search, location.key, rememberLocation])

  const free = location.pathname.startsWith('/setup') || location.pathname.startsWith('/debug')
  if (!setupDone && !free) return <Navigate to={paths.setup('lang')} replace />
  return <Outlet />
}
