import { useEffect } from 'react'

import { useCountries } from '@/api/queries'
import { useSettings } from '@/store/settings'

/** Rise/fall colours follow the country (docs/03 §3.1): Taiwan shows rises in red. */
export function CountryTheme() {
  const code = useSettings((s) => s.country)
  const { data } = useCountries()
  const upIsPos = data?.countries.find((c) => c.code === code)?.up_is_pos ?? true
  useEffect(() => {
    document.documentElement.dataset.up = upIsPos ? 'pos' : 'neg'
  }, [upIsPos])
  return null
}
