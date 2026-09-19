// Versioned localStorage for the persisted stores (docs/04 §4.5, §8). Every change is written
// at once (docs/08 §7). Broken JSON, a stored state of the wrong shape, a version without a
// migration path or a failed migration never stops the app: the store falls back to its
// defaults, which sends the user back to first-run setup.

import type { PersistOptions, PersistStorage, StorageValue } from 'zustand/middleware'

/** Turns a state stored under version n into the shape of version n + 1. */
export type MigrationStep = (state: unknown) => unknown

/** Reads one stored value: the value itself, or `undefined` when it is not valid. */
export type Reader<V> = (value: unknown) => V | undefined

/** One reader per field of `T`. */
export type Readers<T> = { readonly [K in keyof T]-?: Reader<T[K]> }

/** How a store is kept in localStorage. */
export interface PersistedFormat<T extends object> {
  /** localStorage key. */
  readonly name: string
  /** Version of the stored shape. Bump it and add a step whenever the shape changes. */
  readonly version: number
  /** `steps[n]` upgrades a state stored under version n to version n + 1. */
  readonly steps?: Readonly<Partial<Record<number, MigrationStep>>>
  /** State on first run and after a reset; also fills fields a stored state lacks. */
  readonly defaults: T
  readonly readers: Readers<T>
  /** Rules across fields; a state that breaks them is reset as well. */
  readonly check?: (data: T) => boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const readBoolean: Reader<boolean> = (value) =>
  typeof value === 'boolean' ? value : undefined

/** A non-empty string such as an area, crop or unit id. */
export const readId: Reader<string> = (value) =>
  typeof value === 'string' && value !== '' ? value : undefined

export const readOneOf =
  <V extends string>(options: readonly V[]): Reader<V> =>
  (value) =>
    options.find((option) => option === value)

export const readNullable =
  <V>(read: Reader<V>): Reader<V | null> =>
  (value) =>
    value === null ? null : read(value)

/** A list of ids, duplicates dropped (the first one kept), at most `max` of them. */
export const readIds =
  (max = Infinity): Reader<string[]> =>
  (value) => {
    if (!Array.isArray(value)) return undefined
    const ids = value.map(readId)
    if (ids.some((id) => id === undefined)) return undefined
    return [...new Set(ids as string[])].slice(0, max)
  }

/**
 * An object with exactly these fields; unknown fields are dropped. A field that is missing
 * takes its default when `defaults` is given; any invalid field rejects the whole object.
 */
export function readObject<T extends object>(readers: Readers<T>, defaults?: T): Reader<T> {
  return (value) => {
    if (!isRecord(value)) return undefined
    const result: Partial<T> = {}
    for (const key of Object.keys(readers) as (keyof T & string)[]) {
      const read = value[key] === undefined && defaults ? defaults[key] : readers[key](value[key])
      if (read === undefined) return undefined
      result[key] = read
    }
    return result as T
  }
}

/**
 * Upgrades a state stored under version `from` to version `to`, one step at a time.
 * `null` when that is impossible: a step is missing or throws, or the state comes from a
 * newer version of the app.
 */
export function migrateStored(
  state: unknown,
  from: number,
  to: number,
  steps: Readonly<Partial<Record<number, MigrationStep>>> = {},
): unknown {
  if (!Number.isInteger(from) || from < 0 || from > to) return null
  try {
    let migrated = state
    for (let version = from; version < to; version += 1) {
      const step = steps[version]
      if (!step) return null
      migrated = step(migrated)
    }
    return migrated
  } catch {
    return null
  }
}

/**
 * localStorage through JSON. A value that cannot be read counts as nothing stored; when the
 * storage is full or blocked the app keeps working with the state in memory.
 */
export function jsonStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => {
      try {
        const raw = localStorage.getItem(name)
        return raw === null ? null : (JSON.parse(raw) as StorageValue<T>)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, JSON.stringify(value))
      } catch {
        // Full or blocked storage: keep the state in memory only.
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name)
      } catch {
        // Nothing to clean up when the storage is blocked.
      }
    },
  }
}

/**
 * Zustand `persist` options for a store holding the data `T` plus actions. Only the data is
 * saved. Stored data is checked on every load: invalid data, a version without a migration
 * path or a failed migration gives the defaults, and a migrated or reset state is saved.
 */
export function persistOptions<T extends object, S extends T>(
  format: PersistedFormat<T>,
): PersistOptions<S, T> {
  const read = readObject(format.readers, format.defaults)
  const restore = (stored: unknown): T => {
    const data = read(stored)
    return data && (!format.check || format.check(data)) ? data : format.defaults
  }
  const keys = Object.keys(format.defaults) as (keyof T)[]

  return {
    name: format.name,
    version: format.version,
    storage: jsonStorage<T>(),
    partialize: (state) => Object.fromEntries(keys.map((key) => [key, state[key]])) as unknown as T,
    migrate: (stored, version) =>
      restore(migrateStored(stored, version, format.version, format.steps)),
    merge: (stored, current) => ({ ...current, ...restore(stored) }),
  }
}
