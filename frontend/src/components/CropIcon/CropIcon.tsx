import type { ReactNode } from 'react'

import { CropSvg } from '@/icons/crops'

import { toneOf } from '../categories'
import { Tile } from '../Tile/Tile'

export interface CropIconProps {
  /** Crop id from the API, or a category icon from `CATEGORY_ICON`; unknown ids get a box. */
  crop: string
  /** The crop's category (API `category`), which picks the tile colour. */
  category?: string | null
  /** Number key cap (`1`–`9`) for the first nine items; not drawn on 128×160. */
  keyCap?: ReactNode
}

/** Crop tile: the category's light colour behind the crop's colour illustration (docs/03 §4). */
export function CropIcon({ crop, category, keyCap }: CropIconProps) {
  return (
    <Tile tone={toneOf(category)} keyCap={keyCap} art>
      <CropSvg id={crop} />
    </Tile>
  )
}
