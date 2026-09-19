/**
 * History rules (docs/04 §4.3): every screen and every panel is one history entry, so the right
 * soft key (history.back()) closes a panel, then leaves a screen, then leaves the app on home.
 * Screens use `useNav()` instead of calling `navigate` directly.
 */
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { selectLastFocusId, useSession } from '@/store/session'
import { useSettings } from '@/store/settings'

import { type SheetName, withoutSheet } from './paths'

export interface Nav {
  /** The open panel (`?sheet=`), if any. */
  sheet: SheetName | null
  /** Opens another screen (one new history entry). */
  open(to: string): void
  /** The right soft key's job; also used by "back" actions inside screens. */
  back(): void
  /** Switches a tab in place: tabs never add history (docs/02 §4). */
  switchTab(to: string): void
  /** Opens a panel on top of the current screen (one new entry; replaces an open panel). */
  openSheet(name: SheetName): void
  /** Closes the open panel (history back). */
  closeSheet(): void
  /** A panel item that opens another screen: the panel's entry becomes that screen. */
  leaveSheet(to: string): void
  /**
   * A panel item that changes the screen below it (another viewed area, another sort): closes
   * the panel (back), then replaces that screen's entry with `to`, so no history is added.
   */
  closeSheetAndReplace(to: string): void
}

// Where to go once the pending history.back() of closeSheetAndReplace has landed.
let pendingReplace: string | null = null

/** Finishes closeSheetAndReplace; RootLayout runs it on every location change. */
export function useApplyPendingReplace(): void {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (pendingReplace === null) return
    const target = pendingReplace
    pendingReplace = null
    void navigate(target, { replace: true })
  }, [location.key, navigate])
}

const SHEETS: readonly string[] = ['menu', 'area', 'sort']

export function useNav(): Nav {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const current = params.get('sheet')
  const sheet = current !== null && SHEETS.includes(current) ? (current as SheetName) : null

  return {
    sheet,
    open: (to) => void navigate(to),
    back: () => void navigate(-1),
    switchTab: (to) => void navigate(to, { replace: true }),
    openSheet: (name) => {
      const next = new URLSearchParams(location.search)
      next.set('sheet', name)
      void navigate(
        { pathname: location.pathname, search: `?${next.toString()}` },
        { replace: sheet !== null },
      )
    },
    closeSheet: () => {
      if (sheet === null) return
      if (location.key === 'default') {
        // Opened straight into a panel (no entry below): just drop the parameter.
        void navigate(withoutSheet(location.pathname + location.search), { replace: true })
      } else {
        void navigate(-1)
      }
    },
    leaveSheet: (to) => void navigate(to, { replace: true }),
    closeSheetAndReplace: (to) => {
      if (sheet === null || location.key === 'default') {
        void navigate(to, { replace: true })
        return
      }
      pendingReplace = to
      void navigate(-1)
    },
  }
}

/**
 * Where the app starts (F13): opening the app at home returns to the last screen, with home
 * underneath so the back key still reaches home instead of leaving the app. Any other start
 * URL (a reload, a shared link) is kept as it is.
 */
export function startEntries(startPath: string): { entries: string[]; index: number } {
  const last = useSession.getState().lastLocation?.path
  const { setupDone } = useSettings.getState()
  if (startPath !== '/' || !setupDone || !last) return { entries: [startPath], index: 0 }
  const target = withoutSheet(last)
  if (target.startsWith('/setup') || target.startsWith('/debug')) {
    return { entries: [startPath], index: 0 }
  }
  if (target === '/' || target.startsWith('/?')) return { entries: [target], index: 0 }
  return { entries: ['/', target], index: 1 }
}

function randomKey(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Applies `startEntries` to the browser history before the router reads it. */
export function applyStartEntries(win: Window = window): void {
  const current = win.location.pathname + win.location.search
  const { entries, index } = startEntries(current)
  if (index === 0 && entries[0] === current) return
  const lastFocus = selectLastFocusId(useSession.getState())
  // React Router's own history state shape, so its entry index stays consistent.
  win.history.replaceState({ usr: null, key: 'default', idx: 0 }, '', entries[0])
  const restored = entries[index]
  if (index === 1 && restored) {
    const key = randomKey()
    win.history.pushState({ usr: null, key, idx: 1 }, '', restored)
    if (lastFocus) useSession.getState().rememberFocus(key, lastFocus)
  } else if (lastFocus) {
    // The restored screen is home itself: its entry now has the key "default".
    useSession.getState().rememberFocus('default', lastFocus)
  }
}
