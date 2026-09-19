import { describe, expect, it } from 'vitest'

import { DEFAULT_UNIT_TABLES, UNITS, defaultUnitTable, resolveUnit, toUnit } from './units'

const ids = (options: readonly { id: string }[]) => options.map((unit) => unit.id)

describe('UNITS', () => {
  it('defines the per-kg factor and decimals of each unit (docs/06 §5)', () => {
    expect(UNITS.kg).toEqual({ id: 'kg', perKg: 1, decimals: 1 })
    expect(UNITS.qtl).toEqual({ id: 'qtl', perKg: 100, decimals: 0 })
    expect(UNITS.catty).toEqual({ id: 'catty', perKg: 0.6, decimals: 1 })
  })
})

describe('DEFAULT_UNIT_TABLES', () => {
  it('lists quintal first for Indian wholesale and kg first for Indian retail', () => {
    const { wholesale, retail } = DEFAULT_UNIT_TABLES.IN
    expect(ids(wholesale.options)).toEqual(['qtl', 'kg'])
    expect(wholesale.defaultId).toBe('qtl')
    expect(ids(retail.options)).toEqual(['kg', 'qtl'])
    expect(retail.defaultId).toBe('kg')
  })

  it('offers kg (default) and catty for both Taiwanese price types', () => {
    for (const choice of [DEFAULT_UNIT_TABLES.TW.wholesale, DEFAULT_UNIT_TABLES.TW.retail]) {
      expect(ids(choice.options)).toEqual(['kg', 'catty'])
      expect(choice.defaultId).toBe('kg')
    }
  })

  it('offers kg with sen (default) and kati for both Malaysian price types', () => {
    for (const choice of [DEFAULT_UNIT_TABLES.MY.wholesale, DEFAULT_UNIT_TABLES.MY.retail]) {
      expect(choice.options).toEqual([UNITS.kgSen, UNITS.kati])
      expect(choice.defaultId).toBe('kg')
    }
    expect(UNITS.kati).toEqual({ id: 'kati', perKg: 0.605, decimals: 2 })
  })
})

describe('defaultUnitTable', () => {
  it('returns the table of a known country', () => {
    expect(defaultUnitTable('MY')).toBe(DEFAULT_UNIT_TABLES.MY)
    expect(defaultUnitTable('IN')).toBe(DEFAULT_UNIT_TABLES.IN)
  })

  it('gives kg to a country without a table, or when none is chosen', () => {
    for (const code of ['JP', null, undefined]) {
      const table = defaultUnitTable(code)
      expect(table.wholesale.options).toEqual([UNITS.kg])
      expect(table.retail.defaultId).toBe('kg')
    }
  })
})

describe('toUnit', () => {
  it('converts a per-kg price into the unit', () => {
    expect(toUnit(23.5, UNITS.qtl)).toBe(2350)
    expect(toUnit(23.5, UNITS.kg)).toBe(23.5)
    expect(toUnit(38.5, UNITS.catty)).toBeCloseTo(23.1, 10)
  })

  it('keeps a missing price missing', () => {
    expect(toUnit(null, UNITS.qtl)).toBeNull()
    expect(toUnit(undefined, UNITS.qtl)).toBeNull()
  })
})

describe('resolveUnit', () => {
  const inWholesale = DEFAULT_UNIT_TABLES.IN.wholesale

  it('returns the unit the user chose', () => {
    expect(resolveUnit(inWholesale, 'kg')).toBe(UNITS.kg)
  })

  it('falls back to the default when the choice is unknown or unset', () => {
    expect(resolveUnit(inWholesale, 'catty')).toBe(UNITS.qtl)
    expect(resolveUnit(inWholesale, null)).toBe(UNITS.qtl)
    expect(resolveUnit(inWholesale)).toBe(UNITS.qtl)
  })

  it('falls back to the first option when the default is not listed', () => {
    expect(resolveUnit({ options: [UNITS.catty, UNITS.kg], defaultId: 'qtl' })).toBe(UNITS.catty)
  })

  it('falls back to kg when there are no options at all', () => {
    expect(resolveUnit({ options: [], defaultId: 'qtl' }, 'qtl')).toBe(UNITS.kg)
  })
})
