// Crop categories as drawn (docs/03 §3.1, §8). Each country lists its own categories in the
// API (`categories`: name, illustration and colour family, in home grid order); this file
// has the colour families, the default seven's tones for series outside a country (the
// international prices) and the home grid's last tile, 「最近」.

import type { CropIconId } from '@/icons/names'

/** Colour family; `data-tone={tone}` sets `--tn` (light tile) and `--tc` (dark line) below it. */
export type Tone =
  'green' | 'orange' | 'amber' | 'red' | 'olive' | 'yellow' | 'slate' | 'blue' | 'purple'

/** The part of a country's category (API `categories[]`) that picks a colour. */
export interface CategoryTone {
  id: string
  tone: Tone
}

/** Tones of the default seven categories, which India and Malaysia use. */
export const DEFAULT_CATEGORY_TONE: Readonly<Record<string, Tone>> = {
  cereal: 'amber',
  veg: 'green',
  fruit: 'orange',
  pulse: 'olive',
  spice: 'red',
  oil: 'yellow',
  other: 'slate',
}

const DEFAULT_TONES: ReadonlyMap<string, Tone> = new Map(Object.entries(DEFAULT_CATEGORY_TONE))

/** The home grid's tile for the international reference prices (bonus B5, docs/02 §5.8). */
export const INTL_TILE: { readonly id: 'intl'; readonly icon: CropIconId; readonly tone: Tone } = {
  id: 'intl',
  icon: 'globec',
  tone: 'blue',
}

/** The home grid's last tile after the country's categories: the recently viewed crops. */
export const RECENT_CATEGORY: {
  readonly id: 'recent'
  readonly icon: CropIconId
  readonly tone: Tone
} = { id: 'recent', icon: 'clockc', tone: 'purple' }

/** Tone of a category: from the country's list, else from the default seven (the
 *  international series use those); unknown or missing ones look like "other". */
export function toneOf(
  category: string | null | undefined,
  categories: readonly CategoryTone[] = [],
): Tone {
  if (!category) return 'slate'
  return categories.find((c) => c.id === category)?.tone ?? DEFAULT_TONES.get(category) ?? 'slate'
}
