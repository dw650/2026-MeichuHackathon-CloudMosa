import { setRequestHeaders } from '@/api/client'
import { type SettingsData, useSettings } from '@/store/settings'

import { IS_DEMO_BUILD } from './flags'

/** Days the "area not updated" switch pushes my area's latest trade date back (docs/06 §7.5). */
export const DEMO_STALE_DAYS = 3

/** Request headers for the demo switches (F18, docs/04 §6.2). */
export function demoHeaders(
  settings: Pick<SettingsData, 'demo' | 'areaId'>,
): Record<string, string> {
  const { demo, areaId } = settings
  const headers: Record<string, string> = {}
  if (demo.fail) headers['X-Demo-Fail'] = '1'
  if (demo.stale && areaId) headers['X-Demo-Stale'] = `${areaId}:${DEMO_STALE_DAYS}`
  if (demo.locate !== 'auto') headers['X-Demo-Locate'] = demo.locate
  return headers
}

/** Demo builds send the switches with every request; production builds never do. */
export function installDemoHeaders(): void {
  if (IS_DEMO_BUILD) setRequestHeaders(() => demoHeaders(useSettings.getState()))
}
