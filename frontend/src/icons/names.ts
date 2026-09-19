// Icon names (docs/03 §8). The artwork is in crops.tsx and ui.tsx; the names live here so
// screens and the debug page can list them without importing any JSX.

/** Crop illustrations. `box` and `clockc` stand for the categories other and 「最近」 (`gridc`
 *  was 全部); the other categories reuse a representative crop (API `categories[].icon`). */
export const CROP_ICON_IDS = [
  'onion',
  'tomato',
  'potato',
  'chilli',
  'soybean',
  'maize',
  'wheat',
  'grapes',
  'banana',
  'garlic',
  'cabbage',
  'bokchoy',
  'sweetpotato',
  'scallion',
  'mango',
  'pineapple',
  'cauliflower',
  'waterspinach',
  'rice',
  'eggplant',
  'pomegranate',
  'chickpea',
  'turmeric',
  'peanut',
  'mustard',
  'cotton',
  'sugarcane',
  'guava',
  'adzuki',
  'sesame',
  'mushroom',
  'cucumber',
  'carrot',
  'longbean',
  'frenchbean',
  'ginger',
  'lime',
  'calamansi',
  'coconut',
  'napacabbage',
  'taro',
  'loofah',
  'bittergourd',
  'greenpepper',
  'dragonfruit',
  'passionfruit',
  'papaya',
  'oil',
  'box',
  'gridc',
  'clockc',
] as const

export type CropIconId = (typeof CROP_ICON_IDS)[number]

const CROP_ICONS: ReadonlySet<string> = new Set(CROP_ICON_IDS)

/** True when `id` (a crop id from the API) has its own illustration. */
export function isCropIconId(id: string): id is CropIconId {
  return CROP_ICONS.has(id)
}

/** Single-colour line icons; they take the colour of the surrounding text. */
export const UI_ICON_NAMES = [
  'pin',
  'cal',
  'clock',
  'route',
  'speaker',
  'sort',
  'moon',
  'sun',
  'chev',
  'check',
  'alert',
  'refresh',
  'gear',
  'info',
  'grid',
  'star',
  'store',
  'trend',
  'globe',
  'scale',
  'shield',
  'truck',
  'news',
] as const

export type UiIconName = (typeof UI_ICON_NAMES)[number]
