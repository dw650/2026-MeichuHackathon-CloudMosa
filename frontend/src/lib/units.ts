// Price units (docs/06 §5). The API sends prices per kg in local currency;
// the frontend converts them into the unit the user picked.

/** A price unit, as served by `GET /countries` or taken from the static defaults below. */
export interface UnitSpec {
  /** Stable id kept in the settings, e.g. `qtl`, `kg`, `catty`. */
  readonly id: string
  /** Multiplier from a per-kg price to a price in this unit (quintal 100, catty 0.6). */
  readonly perKg: number
  /** Fixed number of fraction digits shown for this unit. */
  readonly decimals: number
}

/** The units offered for one price type of one country. */
export interface UnitChoice {
  /** Units in display order. */
  readonly options: readonly UnitSpec[]
  /** Id of the unit used until the user picks another one. */
  readonly defaultId: string
}

export type PriceType = 'wholesale' | 'retail'

export type UnitTable = Readonly<Record<PriceType, UnitChoice>>

const KG: UnitSpec = { id: 'kg', perKg: 1, decimals: 1 }
const QUINTAL: UnitSpec = { id: 'qtl', perKg: 100, decimals: 0 }
const CATTY: UnitSpec = { id: 'catty', perKg: 0.6, decimals: 1 }
// Malaysia prices in ringgit and sen; a kati is 0.605 kg.
const KG_SEN: UnitSpec = { id: 'kg', perKg: 1, decimals: 2 }
const KATI: UnitSpec = { id: 'kati', perKg: 0.605, decimals: 2 }

export const UNITS = { kg: KG, qtl: QUINTAL, catty: CATTY, kgSen: KG_SEN, kati: KATI } as const

const KG_ONLY: UnitChoice = { options: [KG], defaultId: KG.id }

/** Unit tables of the supported countries, matching docs/06 §5. */
export const DEFAULT_UNIT_TABLES: Readonly<Record<'IN' | 'TW' | 'MY', UnitTable>> = {
  IN: {
    wholesale: { options: [QUINTAL, KG], defaultId: QUINTAL.id },
    retail: { options: [KG, QUINTAL], defaultId: KG.id },
  },
  TW: {
    wholesale: { options: [KG, CATTY], defaultId: KG.id },
    retail: { options: [KG, CATTY], defaultId: KG.id },
  },
  MY: {
    wholesale: { options: [KG_SEN, KATI], defaultId: KG_SEN.id },
    retail: { options: [KG_SEN, KATI], defaultId: KG_SEN.id },
  },
}

/**
 * The static unit table of a country, used only while `GET /countries` has not answered; a
 * country without one gets kg.
 */
export function defaultUnitTable(code: string | null | undefined): UnitTable {
  const tables: Readonly<Record<string, UnitTable | undefined>> = DEFAULT_UNIT_TABLES
  return (code ? tables[code] : undefined) ?? { wholesale: KG_ONLY, retail: KG_ONLY }
}

/**
 * Returns the unit with the saved id. An unknown or unset id falls back to the default,
 * then to the first option, then to kg, so a stale setting never breaks the screen.
 */
export function resolveUnit(choice: UnitChoice, id?: string | null): UnitSpec {
  const byId = (wanted: string) => choice.options.find((unit) => unit.id === wanted)
  return (id ? byId(id) : undefined) ?? byId(choice.defaultId) ?? choice.options[0] ?? KG
}

/** Converts a per-kg price into `unit`; a missing price stays missing (`null`). */
export function toUnit(pricePerKg: number, unit: UnitSpec): number
export function toUnit(pricePerKg: number | null | undefined, unit: UnitSpec): number | null
export function toUnit(pricePerKg: number | null | undefined, unit: UnitSpec): number | null {
  return pricePerKg === null || pricePerKg === undefined ? null : pricePerKg * unit.perKg
}
