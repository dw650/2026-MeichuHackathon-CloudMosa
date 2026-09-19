import { useState } from 'react'
import { RouterProvider } from 'react-router'

import { createAppRouter } from '@/app/router'

export default function App() {
  const [router] = useState(createAppRouter)
  return <RouterProvider router={router} />
}
