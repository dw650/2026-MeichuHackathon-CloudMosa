import type { RouteObject } from 'react-router'

import { IS_DEMO_BUILD } from './flags'

/** Debug pages exist only in dev and demo builds (docs/07 §1.1); production bundles drop them. */
export const debugRoutes: RouteObject[] = IS_DEMO_BUILD
  ? [
      {
        path: '/debug/keys',
        lazy: async () => ({ Component: (await import('@/screens/debug/DebugKeys')).default }),
      },
      {
        path: '/debug/viewport',
        lazy: async () => ({ Component: (await import('@/screens/debug/DebugViewport')).default }),
      },
    ]
  : []
