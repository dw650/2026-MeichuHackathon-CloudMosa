import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { debugRoutes } from '@/app/debugRoutes'
import { Shell } from '@/components/Shell/Shell'

// Placeholder screen until the full route table (T21) and i18n (T17) land.
function Placeholder() {
  return (
    <Shell title="AgriPrice" softKeys={{ left: 'Menu', center: 'OK', right: 'Exit' }}>
      <p style={{ padding: 'var(--gut)' }}>AgriPrice</p>
    </Shell>
  )
}

const router = createBrowserRouter([...debugRoutes, { path: '*', Component: Placeholder }])

export default function App() {
  return <RouterProvider router={router} />
}
