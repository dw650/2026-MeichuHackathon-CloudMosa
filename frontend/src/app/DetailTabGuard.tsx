import type { ComponentType } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'

import { DETAIL_TABS, type DetailTab } from './paths'

/** Only trend, today and compare exist; anything else opens the default tab (today). */
export function DetailTabGuard({ screen: Screen }: { screen: ComponentType }) {
  const { cropId = '', tab = '' } = useParams()
  const { search } = useLocation()
  if (!DETAIL_TABS.includes(tab as DetailTab)) {
    return <Navigate to={`/crop/${cropId}/today${search}`} replace />
  }
  return <Screen />
}
