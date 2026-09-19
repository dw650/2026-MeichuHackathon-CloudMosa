// Session state (docs/04 §4.3–§4.5, F13): the last screen, the focused item of each history
// entry and the recently viewed crops. Saved to localStorage on every change (docs/08 §7) so
// reopening the app returns to the same screen and focus.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  persistOptions,
  readId,
  readIds,
  readNullable,
  readObject,
  type PersistedFormat,
  type Reader,
} from './migrate'

export const SESSION_STORAGE_KEY = 'agriprice.session'
/** Bump with a migration step in `steps` whenever the stored shape changes. */
export const SESSION_VERSION = 1

/** History entries whose focus is kept; older ones are dropped so storage stays small. */
export const FOCUS_ENTRIES_MAX = 50
/** Crops listed under 最近看過 on the home grid (docs/02 §5.2). */
export const RECENT_CROPS_MAX = 5

/** A screen the router showed. */
export interface LastLocation {
  /** `pathname + search`, e.g. `/crop/onion/today?area=pune`. */
  readonly path: string
  /** `location.key` of that history entry. */
  readonly key: string
}

/** The focused item (`data-focus-id`) of one history entry (`location.key`). */
export interface FocusEntry {
  readonly key: string
  readonly id: string
}

export interface SessionData {
  /** The last screen shown, restored on reopening (F13); `null` before the first one. */
  readonly lastLocation: LastLocation | null
  /** Focus per history entry, oldest first, at most `FOCUS_ENTRIES_MAX`. */
  readonly focus: readonly FocusEntry[]
  /** Crop ids, most recently opened first, at most `RECENT_CROPS_MAX`. */
  readonly recentCrops: readonly string[]
}

export interface SessionActions {
  /** Records the screen now shown; call on every navigation. */
  rememberLocation(path: string, key: string): void
  /** Records the focused item of a history entry; call on every focus move. */
  rememberFocus(key: string, id: string): void
  /** Records that a crop's detail was opened. */
  viewCrop(cropId: string): void
  /** Empties the recently viewed crops, e.g. when the country changes. */
  clearRecentCrops(): void
}

export type SessionState = SessionData & SessionActions

const DEFAULT_SESSION: SessionData = { lastLocation: null, focus: [], recentCrops: [] }

/** Adds or refreshes one entry as the newest, dropping the oldest beyond the limit. */
const withFocus = (entries: readonly FocusEntry[], entry: FocusEntry): FocusEntry[] =>
  [...entries.filter((e) => e.key !== entry.key), entry].slice(-FOCUS_ENTRIES_MAX)

/** Only paths inside the app: `/…`, never `//host` or a full URL. */
const readPath: Reader<string> = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined

const readFocusEntry = readObject<FocusEntry>({ key: readId, id: readId })

const readFocus: Reader<FocusEntry[]> = (value) => {
  if (!Array.isArray(value)) return undefined
  const entries = value.map(readFocusEntry)
  if (entries.some((entry) => entry === undefined)) return undefined
  return (entries as FocusEntry[]).reduce(withFocus, [])
}

const sessionFormat: PersistedFormat<SessionData> = {
  name: SESSION_STORAGE_KEY,
  version: SESSION_VERSION,
  steps: {},
  defaults: DEFAULT_SESSION,
  readers: {
    lastLocation: readNullable(readObject<LastLocation>({ path: readPath, key: readId })),
    focus: readFocus,
    recentCrops: readIds(RECENT_CROPS_MAX),
  },
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SESSION,
      rememberLocation: (path, key) => set({ lastLocation: { path, key } }),
      rememberFocus: (key, id) => {
        // Focus moves on every arrow key; skip the write when the newest entry is unchanged.
        const newest = get().focus.at(-1)
        if (newest?.key === key && newest.id === id) return
        set((state) => ({ focus: withFocus(state.focus, { key, id }) }))
      },
      viewCrop: (cropId) =>
        set((state) => ({
          recentCrops: [cropId, ...state.recentCrops.filter((id) => id !== cropId)].slice(
            0,
            RECENT_CROPS_MAX,
          ),
        })),
      clearRecentCrops: () => set({ recentCrops: [] }),
    }),
    persistOptions<SessionData, SessionState>(sessionFormat),
  ),
)

/** Focused item id of a history entry; `null` when none was recorded. */
export const selectFocusId =
  (key: string) =>
  (state: SessionData): string | null =>
    state.focus.find((entry) => entry.key === key)?.id ?? null

/** Focused item id of the last screen, used when reopening the app (F13). */
export const selectLastFocusId = (state: SessionData): string | null =>
  state.lastLocation ? selectFocusId(state.lastLocation.key)(state) : null
