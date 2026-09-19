import { createBrowserRouter } from 'react-router'

import { applyStartEntries } from './navigation'
import { appRoutes } from './routes'

/** The app's router; the last screen is restored into the history first (F13). */
export function createAppRouter() {
  applyStartEntries(window)
  return createBrowserRouter(appRoutes)
}
