import type { ReactNode } from 'react'

import { CropSvg } from '@/icons/crops'

import type { Tone } from '../categories'
import { Tile } from '../Tile/Tile'

export interface CropIconProps {
  /** Crop id from the API, or a category icon from the API `categories`; unknown ids get a box. */
  crop: string
  /** The crop category's tone (`toneOf`), which picks the tile colour; slate without one. */
  tone?: Tone
  /** Number key cap (`1`–`9`) for the first nine items; not drawn on 128×160. */
  keyCap?: ReactNode
}

/** Crop tile: the category's light colour behind the crop's colour illustration (docs/03 §4). */
export function CropIcon({ crop, tone, keyCap }: CropIconProps) {
  return (
    <Tile tone={tone ?? 'slate'} keyCap={keyCap} art>
      <CropSvg id={crop} />
    </Tile>
  )
}
