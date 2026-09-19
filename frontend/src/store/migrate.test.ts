import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  jsonStorage,
  migrateStored,
  persistOptions,
  readBoolean,
  readId,
  readIds,
  readNullable,
  readObject,
  readOneOf,
  type PersistedFormat,
} from './migrate'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('jsonStorage', () => {
  const storage = jsonStorage<{ n: number }>()

  it('writes JSON to localStorage and reads it back', () => {
    storage.setItem('k', { state: { n: 1 }, version: 2 })
    expect(JSON.parse(localStorage.getItem('k') ?? '')).toEqual({ state: { n: 1 }, version: 2 })
    expect(storage.getItem('k')).toEqual({ state: { n: 1 }, version: 2 })
    storage.removeItem('k')
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('treats a missing key and broken JSON as nothing stored', () => {
    expect(storage.getItem('k')).toBeNull()
    localStorage.setItem('k', '{"state": {')
    expect(storage.getItem('k')).toBeNull()
  })

  it('keeps the app running when localStorage throws', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
    }
    expect(storage.getItem('k')).toBeNull()
    expect(() => storage.setItem('k', { state: { n: 1 } })).not.toThrow()
    expect(() => storage.removeItem('k')).not.toThrow()
  })
})

describe('migrateStored', () => {
  // v1 { a } → v2 { a, b } → v3 { total }
  const steps = {
    1: (s: unknown) => ({ ...(s as { a: number }), b: 2 }),
    2: (s: unknown) => {
      const { a, b } = s as { a: number; b: number }
      return { total: a + b }
    },
  }

  it('runs every step from the stored version up to the current one, in order', () => {
    expect(migrateStored({ a: 1 }, 1, 3, steps)).toEqual({ total: 3 })
    expect(migrateStored({ a: 1, b: 5 }, 2, 3, steps)).toEqual({ total: 6 })
  })

  it('returns the state unchanged when the version is current', () => {
    expect(migrateStored({ total: 3 }, 3, 3, steps)).toEqual({ total: 3 })
  })

  it.each([
    ['a missing step', 0],
    ['a newer version', 4],
    ['a negative version', -1],
    ['a fractional version', 1.5],
  ])('gives up (null) on %s', (_, from) => {
    expect(migrateStored({ a: 1 }, from, 3, steps)).toBeNull()
  })

  it('gives up (null) when a step throws', () => {
    const failing = {
      1: () => {
        throw new Error('bad data')
      },
    }
    expect(migrateStored({ a: 1 }, 1, 2, failing)).toBeNull()
  })
})

describe('readers', () => {
  it('reads booleans, non-empty ids and listed options', () => {
    expect(readBoolean(false)).toBe(false)
    expect(readBoolean('true')).toBeUndefined()
    expect(readId('onion')).toBe('onion')
    expect(readId('')).toBeUndefined()
    expect(readId(3)).toBeUndefined()
    const readSize = readOneOf(['s', 'm'] as const)
    expect(readSize('m')).toBe('m')
    expect(readSize('l')).toBeUndefined()
  })

  it('accepts null only when nullable', () => {
    expect(readId(null)).toBeUndefined()
    expect(readNullable(readId)(null)).toBeNull()
    expect(readNullable(readId)('pune')).toBe('pune')
    expect(readNullable(readId)(1)).toBeUndefined()
  })

  it('reads id lists without duplicates, up to a maximum', () => {
    expect(readIds()(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
    expect(readIds(2)(['a', 'b', 'a', 'c'])).toEqual(['a', 'b'])
    expect(readIds()([])).toEqual([])
    expect(readIds()(['a', 1])).toBeUndefined()
    expect(readIds()('a')).toBeUndefined()
  })

  describe('readObject', () => {
    const readers = { name: readId, on: readBoolean }

    it('reads every field and drops unknown ones', () => {
      expect(readObject(readers)({ name: 'x', on: true, extra: 1 })).toEqual({
        name: 'x',
        on: true,
      })
    })

    it('rejects a missing field unless there is a default for it', () => {
      expect(readObject(readers)({ name: 'x' })).toBeUndefined()
      expect(readObject(readers, { name: 'd', on: false })({ name: 'x' })).toEqual({
        name: 'x',
        on: false,
      })
    })

    it('rejects an invalid field even when there is a default', () => {
      expect(
        readObject(readers, { name: 'd', on: false })({ name: 'x', on: 'yes' }),
      ).toBeUndefined()
    })

    it.each([null, [], 'x', 3])('rejects %j', (value) => {
      expect(readObject(readers)(value)).toBeUndefined()
    })
  })
})

describe('persistOptions', () => {
  interface Data {
    count: number
    tags: string[]
  }
  interface State extends Data {
    add: (tag: string) => void
  }

  const readCount = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : undefined)
  const format: PersistedFormat<Data> = {
    name: 'test.store',
    version: 2,
    // v1 kept the tags as one comma-separated string.
    steps: {
      1: (s) => ({ ...(s as object), tags: String((s as { tags: string }).tags).split(',') }),
    },
    defaults: { count: 0, tags: [] },
    readers: { count: readCount, tags: readIds() },
  }

  const createTestStore = () =>
    create<State>()(
      persist(
        (set) => ({
          ...format.defaults,
          add: (tag) => set((s) => ({ count: s.count + 1, tags: [...s.tags, tag] })),
        }),
        persistOptions<Data, State>(format),
      ),
    )
  const stored = () => JSON.parse(localStorage.getItem('test.store') ?? 'null') as unknown
  const seed = (value: unknown) =>
    localStorage.setItem('test.store', typeof value === 'string' ? value : JSON.stringify(value))

  it('saves only the data, with the version, on every change', () => {
    const store = createTestStore()
    store.getState().add('a')
    expect(stored()).toEqual({ state: { count: 1, tags: ['a'] }, version: 2 })
    store.getState().add('b')
    expect(stored()).toEqual({ state: { count: 2, tags: ['a', 'b'] }, version: 2 })
  })

  it('restores valid stored data, filling fields it lacks with defaults', () => {
    seed({ state: { count: 5, tags: ['x'] }, version: 2 })
    const store = createTestStore()
    expect(store.getState()).toMatchObject({ count: 5, tags: ['x'] })
    expect(store.persist.hasHydrated()).toBe(true)
    seed({ state: { count: 7 }, version: 2 })
    void store.persist.rehydrate()
    expect(store.getState()).toMatchObject({ count: 7, tags: [] })
    expect(typeof store.getState().add).toBe('function')
  })

  it.each([
    ['broken JSON', '{"state":'],
    ['a stored value that is not an object', '42'],
    ['a state of the wrong shape', { state: { count: 'many', tags: ['x'] }, version: 2 }],
    ['a missing state', { version: 2 }],
  ])('starts from the defaults on %s', (_, value) => {
    seed(value)
    const store = createTestStore()
    expect(store.getState()).toMatchObject(format.defaults)
    expect(store.persist.hasHydrated()).toBe(true)
    store.getState().add('a')
    expect(stored()).toEqual({ state: { count: 1, tags: ['a'] }, version: 2 })
  })

  it('migrates an older version and saves the result', () => {
    seed({ state: { count: 3, tags: 'a,b' }, version: 1 })
    const store = createTestStore()
    expect(store.getState()).toMatchObject({ count: 3, tags: ['a', 'b'] })
    expect(stored()).toEqual({ state: { count: 3, tags: ['a', 'b'] }, version: 2 })
  })

  it.each([
    ['no migration path', { state: { count: 3, tags: [] }, version: 0 }],
    ['a newer version', { state: { count: 3, tags: [] }, version: 3 }],
    ['a migrated state that is still invalid', { state: { count: -1, tags: 'a' }, version: 1 }],
  ])('resets to the defaults and saves them on %s', (_, value) => {
    seed(value)
    const store = createTestStore()
    expect(store.getState()).toMatchObject(format.defaults)
    expect(stored()).toEqual({ state: format.defaults, version: 2 })
  })

  it('checks the whole state with `check` after reading it', () => {
    const checked = persistOptions<Data, State>({
      ...format,
      check: (data) => data.tags.length === data.count,
    })
    const restore = (value: unknown) => checked.merge?.(value, createTestStore().getState())
    expect(restore({ count: 1, tags: ['a'] })).toMatchObject({ count: 1, tags: ['a'] })
    expect(restore({ count: 2, tags: ['a'] })).toMatchObject(format.defaults)
  })
})
