import { useState } from 'react'
import { RouterProvider } from 'react-router'

import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/router'

export default function App() {
  const [router] = useState(createAppRouter)
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
