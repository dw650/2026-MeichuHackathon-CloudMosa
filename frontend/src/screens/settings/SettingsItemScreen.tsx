import { Navigate, useParams } from 'react-router'

import { IS_DEMO_BUILD } from '@/app/flags'
import { paths } from '@/app/paths'

import { DemoSettings } from './DemoSettings'
import { LanguageSettings } from './LanguageSettings'

/**
 * `/settings/:item`: the list behind a settings row, 語言 (`language`) or, in demo builds only,
 * the Demo switches (`demo`). Anything else goes back to the settings.
 */
export default function SettingsItemScreen() {
  const { item } = useParams()
  if (item === 'language') return <LanguageSettings />
  if (item === 'demo' && IS_DEMO_BUILD) return <DemoSettings />
  return <Navigate to={paths.settings()} replace />
}
