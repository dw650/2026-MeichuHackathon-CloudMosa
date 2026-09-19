import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { createQueryClient } from '@/api/queryClient'

import { CountryTheme } from './CountryTheme'

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient())
  return (
    <QueryClientProvider client={client}>
      <CountryTheme />
      {children}
    </QueryClientProvider>
  )
}
