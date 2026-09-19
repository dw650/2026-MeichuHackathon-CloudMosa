// Crop categories as drawn (docs/03 §3.1, §8): each has a colour family (a light tile colour
// and a dark chart colour, see the `data-tone` rules in styles/tokens.css) and reuses the
// illustration of a representative crop.

import type { CropIconId } from '@/icons/names'

/** Colour family; `data-tone={tone}` sets `--tn` (light tile) and `--tc` (dark line) below it. */
export type Tone =
  'green' | 'orange' | 'amber' | 'red' | 'olive' | 'yellow' | 'slate' | 'blue' | 'purple'

/** The backend categories plus the home grid's "all" and "recent", in keypad order 1–9. */
export const CATEGORY_IDS = [
  'cereal',
  'veg',
  'fruit',
  'pulse',
  'spice',
  'oil',
  'other',
  'all',
  'recent',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export const CATEGORY_TONE: Readonly<Record<CategoryId, Tone>> = {
  cereal: 'amber',
  veg: 'green',
  fruit: 'orange',
  pulse: 'olive',
  spice: 'red',
  oil: 'yellow',
  other: 'slate',
  all: 'blue',
  recent: 'purple',
}

export const CATEGORY_ICON: Readonly<Record<CategoryId, CropIconId>> = {
  cereal: 'wheat',
  veg: 'cabbage',
  fruit: 'mango',
  pulse: 'soybean',
  spice: 'chilli',
  oil: 'oil',
  other: 'box',
  all: 'gridc',
  recent: 'clockc',
}

const CATEGORIES: ReadonlySet<string> = new Set(CATEGORY_IDS)

const isCategoryId = (id: string): id is CategoryId => CATEGORIES.has(id)

/** Tone of a crop's category (API `category`); unknown or missing ones look like "other". */
export function toneOf(category: string | null | undefined): Tone {
  return category && isCategoryId(category) ? CATEGORY_TONE[category] : CATEGORY_TONE.other
}
