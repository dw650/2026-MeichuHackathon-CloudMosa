// First-run setup flow (F01, docs/02 §5.1): language → (more languages) → location check →
// country → area → home. Every setup screen is one history entry; the URL's `?depth=` counts
// the setup entries opened on top of the first one, so finishing can drop them all and leave
// home as the only entry (the back key then leaves the app instead of reopening setup).

import { useRef } from 'react'
import { useLocation } from 'react-router'

import { useLocate } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths, type SetupStep, withParam } from '@/app/paths'
import type { LanguageId } from '@/i18n'
import { byDistance, distanceKm, type LatLon } from '@/lib/geo'
import { COUNTRY_CODES, type CountryCode, useSettings } from '@/store/settings'

export const DEPTH_PARAM = 'depth'

/** Focus id of the retry card shown when a setup list failed to load. */
export const RETRY_ID = 'retry'

/** Setup entries opened on top of the first one (`?depth=`, 0 when missing or invalid). */
export function setupDepth(search: string): number {
  const value = Number(new URLSearchParams(search).get(DEPTH_PARAM))
  return Number.isInteger(value) && value > 0 ? value : 0
}

export function setupPath(step: SetupStep, depth: number): string {
  return withParam(paths.setup(step), DEPTH_PARAM, depth > 0 ? String(depth) : undefined)
}

export function isCountryCode(code: string): code is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(code)
}

export interface LocateGuess {
  readonly country: CountryCode
  readonly areaId: string
}

/** The `/locate` answer as a usable guess; `null` when there is none or the country is unknown. */
export function locateGuess(
  data: { country: string | null; area_id: string | null } | undefined,
): LocateGuess | null {
  if (!data?.country || !data.area_id || !isCountryCode(data.country)) return null
  return { country: data.country, areaId: data.area_id }
}

/**
 * Where a chosen language leads: the location check when the network guessed an area, or
 * while the guess is still on its way (that screen waits for it); otherwise, including when
 * the lookup failed, straight to the country list (docs/02 §5.1).
 */
export function stepAfterLanguage(locate: {
  isPending: boolean
  data: { country: string | null; area_id: string | null } | undefined
}): SetupStep {
  if (locate.isPending) return 'locate'
  return locateGuess(locate.data) ? 'locate' : 'country'
}

export interface SetupAreaRow<T> {
  readonly area: T
  /** Straight-line distance from the default area; 0 for the default area itself. */
  readonly km: number
}

/** The setup area list: the country's default area first, then the rest nearest first. */
export function setupAreaOrder<T extends LatLon & { id: string }>(
  areas: readonly T[],
  defaultId: string,
): SetupAreaRow<T>[] {
  const home = areas.find((a) => a.id === defaultId) ?? areas[0]
  if (!home) return []
  const rest = byDistance(
    areas.filter((a) => a !== home),
    home,
  )
  return [home, ...rest].map((area) => ({ area, km: distanceKm(home, area) }))
}

export interface SetupFlow {
  /** Setup entries below this screen (see `setupDepth`). */
  readonly depth: number
  /** Opens the next setup screen, one entry deeper. */
  next(step: SetupStep): void
  /** Ends setup on home, going back over every setup entry so none stays behind home. */
  finish(): void
}

export function useSetupFlow(): SetupFlow {
  const nav = useNav()
  const depth = setupDepth(useLocation().search)
  // One move per screen: keys can arrive in bursts on Cloud Phone, and a second OK before the
  // next screen shows would add an entry that `depth` does not count.
  const moved = useRef(false)
  const once = (move: () => void) => {
    if (moved.current) return
    moved.current = true
    move()
  }
  return {
    depth,
    next: (step) => once(() => nav.open(setupPath(step, depth + 1))),
    finish: () => once(() => nav.backAndReplace(paths.home(), depth)),
  }
}

/**
 * Choosing a language on either language screen: saves it (the UI switches at once) and moves
 * on with the screen's `flow`. Also starts the network location lookup, so the guess is
 * usually ready by then.
 */
export function useChooseLanguage(flow: SetupFlow): (language: LanguageId) => void {
  const locate = useLocate()
  const chooseLanguage = useSettings((s) => s.chooseLanguage)
  return (language) => {
    chooseLanguage(language)
    flow.next(stepAfterLanguage(locate))
  }
}
