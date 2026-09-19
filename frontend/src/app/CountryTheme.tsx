import type { ReactNode } from 'react'

import { useCountries } from '@/api/queries'
import { UpIsPosContext } from '@/components/rise'
import { useSettings } from '@/store/settings'

/** Rise/fall colours follow the chosen country (docs/03 §3.1): Taiwan shows rises in red. */
export function CountryTheme({ children }: { children: ReactNode }) {
  const code = useSettings((s) => s.country)
  const { data } = useCountries()
  const upIsPos = data?.countries.find((c) => c.code === code)?.up_is_pos ?? true
  return <UpIsPosContext value={upIsPos}>{children}</UpIsPosContext>
}
