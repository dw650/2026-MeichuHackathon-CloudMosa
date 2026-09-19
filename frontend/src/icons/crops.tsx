// Crop illustrations moved from ui-mockup/src/icons.js (docs/03 §8): flat colour art on a
// 24×24 viewBox, a different one for every crop. No emoji.
import type { ReactElement } from 'react'

import { isCropIconId, type CropIconId } from './names'

// Shapes repeated within one icon, centred on 0,0 and placed with translate/rotate.
const CHICKPEA = 'M-3.2-1.85Q-3.3-2.7-3.18-3.18-2.7-3.3-1.85-3.2A3.7 3.7 0 1 1-3.2-1.85z'
const CHICKPEA_CREASE = 'M-2.6-2.6c.9.6 1.4 1.6 1.4 2.8'
const SESAME_SEED = 'M0-2.4C.9-1.6 1.6-.4 1.6.7S.9 2.3 0 2.3-1.6 1.7-1.6.7-.9-1.6 0-2.4z'

const ART: Readonly<Record<CropIconId, ReactElement>> = {
  onion: (
    <>
      <path
        d="M12 5.5c-2.6 2.2-6 4.6-6 9.3A6 6 0 0 0 18 14.8c0-4.7-3.4-7.1-6-9.3z"
        fill="#A23A6B"
      />
      <path
        d="M12 6.5c-1.1 2-2.2 4.8-2.2 8.3s1 5.1 2.2 5.4M12 6.5c1.1 2 2.2 4.8 2.2 8.3s-1 5.1-2.2 5.4"
        fill="none"
        stroke="#DB8AB0"
        strokeWidth="1.1"
      />
      <path
        d="M12 5.5V2.5M12 4l-2-1.5M12 4l2-1.5"
        stroke="#3F8F3A"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  tomato: (
    <>
      <circle cx="12" cy="13.5" r="7.5" fill="#E2412F" />
      <path
        d="M12 6.2l1.6 1.8 2.4-.6-1.2 2 1.9 1.2-2.6.2L12 12l-2.1-1.2-2.6-.2 1.9-1.2-1.2-2 2.4.6z"
        fill="#3E9A3A"
      />
      <ellipse cx="8.8" cy="13" rx="1.3" ry="2.1" fill="#F79282" opacity=".75" />
    </>
  ),
  potato: (
    <>
      <ellipse cx="12" cy="13" rx="8.5" ry="6.3" transform="rotate(-18 12 13)" fill="#C8955A" />
      <g fill="#8A5E2F">
        <circle cx="9" cy="11.5" r=".9" />
        <circle cx="14" cy="10" r=".8" />
        <circle cx="15" cy="15" r=".9" />
        <circle cx="10.5" cy="15.5" r=".7" />
      </g>
    </>
  ),
  chilli: (
    <>
      <path
        d="M7 7c3 1 4 5 5.5 8.5S17 21 19.5 20.5c-3.5 2-8.5-.5-11-5.5C7 12 6.5 9 7 7z"
        fill="#3E9A3A"
      />
      <path
        d="M7 7c.2-1.5 1-2.5 2.3-3"
        stroke="#2E6B2A"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8.4 9.5c1 2 1.8 4.5 3.2 7"
        stroke="#8FD77C"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  soybean: (
    <>
      <path
        d="M4.5 15.5C6 9 12 5 19 5.5c.8 6.5-4.5 12.5-11 13.5-1.8.3-3-1.3-3.5-3.5z"
        fill="#9BBF4A"
      />
      <g fill="#EAD36A">
        <circle cx="9" cy="15" r="2" />
        <circle cx="12.5" cy="11.5" r="2" />
        <circle cx="16" cy="8.2" r="1.8" />
      </g>
    </>
  ),
  maize: (
    <>
      <path d="M12 3c2.8 0 4 4 4 9s-1.6 8-4 8-4-3-4-8 1.2-9 4-9z" fill="#F2C12E" />
      <path
        d="M10 8h4M9.5 11h5M9.6 14h4.8M10.2 17h3.6M12 3.5v16"
        stroke="#D69A12"
        strokeWidth=".9"
        fill="none"
      />
      <path
        d="M12 21c-3-1-5.5-4-6-9 2 1.5 3.5 4 4.5 7zM12 21c3-1 5.5-4 6-9-2 1.5-3.5 4-4.5 7z"
        fill="#5DAA3F"
      />
    </>
  ),
  wheat: (
    <>
      <path d="M12 21V7" stroke="#B07A1E" strokeWidth="1.4" strokeLinecap="round" />
      <g fill="#E0A62B">
        <ellipse cx="12" cy="5" rx="1.6" ry="2.6" />
        <ellipse cx="9.6" cy="9" rx="1.5" ry="2.4" transform="rotate(-35 9.6 9)" />
        <ellipse cx="14.4" cy="9" rx="1.5" ry="2.4" transform="rotate(35 14.4 9)" />
        <ellipse cx="9.6" cy="13" rx="1.5" ry="2.4" transform="rotate(-35 9.6 13)" />
        <ellipse cx="14.4" cy="13" rx="1.5" ry="2.4" transform="rotate(35 14.4 13)" />
        <ellipse cx="9.8" cy="17" rx="1.4" ry="2.2" transform="rotate(-35 9.8 17)" />
        <ellipse cx="14.2" cy="17" rx="1.4" ry="2.2" transform="rotate(35 14.2 17)" />
      </g>
    </>
  ),
  grapes: (
    <>
      <path d="M12 5.2V3" stroke="#4E9A3E" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12 4.5c1.5-1.8 3.5-2 5-1.5-1 1.8-2.8 2.4-5 1.5z" fill="#4E9A3E" />
      <g fill="#7A3FA6">
        <circle cx="9" cy="8" r="2.3" />
        <circle cx="13.6" cy="8" r="2.3" />
        <circle cx="7.4" cy="12" r="2.3" />
        <circle cx="11.5" cy="12" r="2.3" />
        <circle cx="15.6" cy="12" r="2.3" />
        <circle cx="9.6" cy="16" r="2.3" />
        <circle cx="13.6" cy="16" r="2.3" />
        <circle cx="11.6" cy="19.8" r="2.1" />
      </g>
    </>
  ),
  banana: (
    <>
      <path
        d="M4 9c2 6 7 10 14 9.5 1.5-.1 2-1.2 1-1.8C12.5 17 8.5 13 7 8c-.4-1.3-2.4-1.5-3 1z"
        fill="#F4CF3A"
      />
      <path d="M6.5 9.5c2 4.5 6 7.5 11.5 7.8" stroke="#D4A017" strokeWidth="1" fill="none" />
      <path d="M4 9l-1.2-2.4" stroke="#6B5314" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  garlic: (
    <>
      <path
        d="M12 4c-1 2.5-7 5-7 10a7 7 0 0 0 14 0c0-5-6-7.5-7-10z"
        fill="#F4EFE6"
        stroke="#B8A88C"
        strokeWidth="1"
      />
      <path
        d="M12 6c-1.5 3-3 6-3 9.5M12 6c1.5 3 3 6 3 9.5M12 6v13"
        stroke="#C9BBA3"
        strokeWidth="1"
        fill="none"
      />
      <path d="M12 4V2" stroke="#8FA36B" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  cabbage: (
    <>
      <circle cx="12" cy="12.5" r="8" fill="#7CC35B" />
      <path
        d="M12 5c-2 2.5-3 5-3 7.5S10 18 12 20.5M12 5c2 2.5 3 5 3 7.5S14 18 12 20.5"
        stroke="#3F8A32"
        strokeWidth="1.1"
        fill="none"
      />
      <path d="M5 11c2 .5 4 2 7 2s5-1.5 7-2" stroke="#C3EAA8" strokeWidth="1.1" fill="none" />
    </>
  ),
  bokchoy: (
    <>
      <path
        d="M10 21c-.5-4-.5-7 0-10h4c.5 3 .5 6 0 10z"
        fill="#EEF5E4"
        stroke="#B4CF9B"
        strokeWidth=".8"
      />
      <path d="M12 11C8 10 5 7 6 3c3 0 6 3 6 8zM12 11c4-1 7-4 6-8-3 0-6 3-6 8z" fill="#3E9A3A" />
      <path d="M12 11c-1.5-2-1.5-5 0-8 1.5 3 1.5 6 0 8z" fill="#62BF4E" />
    </>
  ),
  sweetpotato: (
    <>
      <path
        d="M4 14c1.5-5 7-8.5 12.5-7.5 3 .5 4 2.8 3 4.5-2 3.5-8 6.5-12.5 6-2-.2-3.3-1.4-3-3z"
        fill="#B24A6E"
      />
      <path d="M19.5 11l2-1M4 14.5l-2 1" stroke="#7A2E4A" strokeWidth="1.3" strokeLinecap="round" />
      <g fill="#E794B2">
        <circle cx="10" cy="12" r=".7" />
        <circle cx="14" cy="10.5" r=".7" />
      </g>
    </>
  ),
  scallion: (
    <>
      <path d="M9 21v-7M12 21v-8M15 21v-7" stroke="#EDEBDC" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M9 14c-1-4-2.5-8-4-11M12 13c0-4 .2-7.5 1-10M15 14c1-4 2.5-7 4.5-10"
        stroke="#3E9A3A"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  mango: (
    <>
      <path d="M7 9c3-4 10-3.5 12 1.5 2 5-1.5 10-7 10S3.5 14 7 9z" fill="#F6A623" />
      <path d="M7 9c3-4 10-3.5 12 1.5-3-1.5-7-1.5-12-1.5z" fill="#E4572E" opacity=".75" />
      <path d="M13 5.5c1-2 3-3 5-2.5-1 2-3 3-5 2.5z" fill="#3E9A3A" />
    </>
  ),
  pineapple: (
    <>
      <ellipse cx="12" cy="15" rx="5.5" ry="6.5" fill="#F2B632" />
      <path
        d="M8 11l8 8M8 15l5 5M11 9.5l6 6M16 11l-8 8M16 15l-5 5M13 9.5l-6 6"
        stroke="#C47F10"
        strokeWidth=".9"
      />
      <path d="M12 9L9 3l2.2 3L12 1.5 12.8 6 15 3z" fill="#3E9A3A" />
    </>
  ),
  cauliflower: (
    <>
      <path
        d="M4.5 15c1 3.5 4 6 7.5 6s6.5-2.5 7.5-6c-2 1-5 1.5-7.5 1.5S6.5 16 4.5 15z"
        fill="#4E9A3E"
      />
      <g fill="#F7F3E3" stroke="#CFC39E" strokeWidth=".8">
        <circle cx="8" cy="12" r="3" />
        <circle cx="12" cy="10" r="3.4" />
        <circle cx="16" cy="12" r="3" />
        <circle cx="10" cy="14.5" r="2.8" />
        <circle cx="14" cy="14.5" r="2.8" />
      </g>
    </>
  ),
  waterspinach: (
    <>
      <path
        d="M12 21V9M12 13l-4-3M12 11l4-4"
        stroke="#6BAF4F"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 9c-1-3 0-5.5 0-7 1.2 2 1.8 4.5 0 7zM8 10c-3 .5-5-1-6-2.5 2.5-.5 4.5 0 6 2.5zM16 7c1-2.8 3.5-3.6 5-3.5-.8 2.3-2.5 3.5-5 3.5z"
        fill="#3E9A3A"
      />
    </>
  ),
  rice: (
    <>
      <path d="M7.8 21.8C5.2 18.5 3.9 14.5 4.2 10c1.9 3 3.3 6.6 4.2 11z" fill="#5DAA3F" />
      <path d="M8 21.8c.5-4.8 3-8.3 7-9.6-2.8 2.6-4.6 5.6-5.4 9.6z" fill="#4E9A3E" />
      <path
        d="M7.8 22C7.4 14 8 7 12 4.2c4.5-1 6.8 3.8 6.3 12.8"
        stroke="#7FA33A"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="#EBBD45">
        <ellipse cx="15" cy="5.4" rx="1.35" ry="2.2" transform="rotate(-47 15 5.4)" />
        <ellipse cx="15.2" cy="3" rx="1.35" ry="2.2" transform="rotate(-123 15.2 3)" />
        <ellipse cx="16" cy="6.7" rx="1.35" ry="2.2" transform="rotate(-15 16 6.7)" />
        <ellipse cx="17.4" cy="4.8" rx="1.35" ry="2.2" transform="rotate(-91 17.4 4.8)" />
        <ellipse cx="16.6" cy="8.5" rx="1.35" ry="2.2" transform="rotate(10 16.6 8.5)" />
        <ellipse cx="18.7" cy="7.4" rx="1.35" ry="2.2" transform="rotate(-66 18.7 7.4)" />
        <ellipse cx="17" cy="11.1" rx="1.35" ry="2.2" transform="rotate(25 17 11.1)" />
        <ellipse cx="19.4" cy="10.6" rx="1.35" ry="2.2" transform="rotate(-51 19.4 10.6)" />
        <ellipse cx="17.2" cy="14.6" rx="1.35" ry="2.2" transform="rotate(35 17.2 14.6)" />
        <ellipse cx="19.6" cy="14.5" rx="1.35" ry="2.2" transform="rotate(-41 19.6 14.5)" />
        <ellipse cx="18.2" cy="18.5" rx="1.35" ry="2.2" transform="rotate(3 18.2 18.5)" />
      </g>
    </>
  ),
  eggplant: (
    <>
      <path
        d="M12.8 6.5C10 8.5 6.5 9.5 4.8 12.1A5 5 0 0 0 12.2 18.9C14.5 17.5 16.8 14 17.2 10.5A3 3 0 0 0 12.8 6.5z"
        fill="#532C80"
      />
      <path
        d="M6.3 14.6c.3-1.3 1.2-2.3 2.4-3"
        stroke="#A47CD0"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M-3.3-.5L-2.6 2.6-1.2.8 0 3.2 1.2.8 2.6 2.6 3.3-.5C3-2.5 1.5-3.4 0-3.4S-3-2.5-3.3-.5z"
        transform="translate(15 8.5) rotate(43)"
        fill="#3E9A3A"
      />
      <path d="M16.7 6.7l1.8-2" stroke="#2E6B2A" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  pomegranate: (
    <>
      <path d="M10.3 8L9 4.4l1.9 1.2L12 3.4l1.1 2.2L15 4.4 13.7 8z" fill="#A11D34" />
      <ellipse cx="12" cy="14.2" rx="8" ry="7.4" fill="#C9243F" />
      <ellipse cx="8.6" cy="12.6" rx="1.5" ry="2.4" fill="#F27A8C" opacity=".7" />
    </>
  ),
  chickpea: (
    <>
      <g fill="#EDCB8A" stroke="#B98C4C" strokeWidth=".8">
        <path d={CHICKPEA} transform="translate(12 8.4) rotate(-20)" />
        <path d={CHICKPEA} transform="translate(8 15.2) rotate(10)" />
        <path d={CHICKPEA} transform="translate(16 15) rotate(95)" />
      </g>
      <g fill="#F9E6BE">
        <ellipse cx="-.4" cy="-.7" rx="1.3" ry=".9" transform="translate(12 8.4) rotate(-20)" />
        <ellipse cx="-.4" cy="-.7" rx="1.3" ry=".9" transform="translate(8 15.2) rotate(10)" />
        <ellipse cx="-.4" cy="-.7" rx="1.3" ry=".9" transform="translate(16 15) rotate(95)" />
      </g>
      <g stroke="#B98C4C" strokeWidth=".8" strokeLinecap="round" fill="none">
        <path d={CHICKPEA_CREASE} transform="translate(12 8.4) rotate(-20)" />
        <path d={CHICKPEA_CREASE} transform="translate(8 15.2) rotate(10)" />
        <path d={CHICKPEA_CREASE} transform="translate(16 15) rotate(95)" />
      </g>
    </>
  ),
  turmeric: (
    <>
      <path
        d="M11.2 13.2c2.4-2.2 4.2-3.4 7.2-4.6M12.8 11.9c.1-2.2.8-4.2 2.2-6.2M13.6 12.4c2.3 0 4.3.8 6.2 2.4"
        stroke="#C8843C"
        strokeWidth="3.8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M6.8 17.4l5.4-5" stroke="#C8843C" strokeWidth="6" />
      <path
        d="M9.6 12.2c1.1.8 1.9 2 2.2 3.4M15.4 9c.8.6 1.3 1.5 1.5 2.5M16.6 12.6c.3.9.3 1.9-.1 2.9M12.7 7.9c.9.2 1.8.8 2.4 1.6"
        stroke="#93541E"
        strokeWidth=".8"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse
        cx="6.8"
        cy="17.4"
        rx="2"
        ry="3"
        transform="rotate(-43 6.8 17.4)"
        fill="#F7931E"
        stroke="#A8652A"
        strokeWidth=".6"
      />
      <ellipse cx="6.8" cy="17.4" rx="1" ry="1.6" transform="rotate(-43 6.8 17.4)" fill="#FFB12B" />
    </>
  ),
  peanut: (
    <g transform="translate(12 12) rotate(45)">
      <path
        d="M0-8.9c2.6 0 4.3 1.8 4.3 4.3S3.1-1.4 3.1 0s1.5 2.1 1.5 4.4S2.6 9 0 9s-4.6-1.8-4.6-4.6S-3.1 1.4-3.1 0s-1.2-2.3-1.2-4.6S-2.6-8.9 0-8.9z"
        fill="#D4A35F"
      />
      <path
        d="M-1.6-7.8v6.6M1.6-7.8v6.6M-1.7 1.2V8M1.7 1.2V8M-3.6-5.8h7.2M-3.4-3.2h6.8M-3.8 3.4h7.6M-3.8 6.1h7.6"
        stroke="#A87A3E"
        strokeWidth=".7"
        fill="none"
      />
    </g>
  ),
  mustard: (
    <>
      <path
        d="M12 22c0-4.5-.3-9 .2-13.5M12 15.5c-1.5-1.5-3-3-4.8-4.6M12.1 13c1.4-1.4 2.8-2.7 4.7-3.8"
        stroke="#4E9A3E"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 20.5c-3 .2-5.5-1-6.8-3.4 3-.3 5.3.8 6.8 3.4zM12 18.5c2.8-.1 5-1.5 6.2-3.9-2.9 0-5 1.2-6.2 3.9z"
        fill="#5DAA3F"
      />
      <g fill="#F6C818" stroke="#E0A410" strokeWidth=".4">
        <circle cx="12.2" cy="5.3" r="1.25" />
        <circle cx="13.4" cy="6.5" r="1.25" />
        <circle cx="12.2" cy="7.7" r="1.25" />
        <circle cx="11" cy="6.5" r="1.25" />
        <circle cx="7" cy="8" r="1.25" />
        <circle cx="8.2" cy="9.2" r="1.25" />
        <circle cx="7" cy="10.4" r="1.25" />
        <circle cx="5.8" cy="9.2" r="1.25" />
        <circle cx="17" cy="7.1" r="1.25" />
        <circle cx="18.2" cy="8.3" r="1.25" />
        <circle cx="17" cy="9.5" r="1.25" />
        <circle cx="15.8" cy="8.3" r="1.25" />
        <circle cx="9.3" cy="3.6" r="1.1" />
        <circle cx="15" cy="3.4" r="1.1" />
      </g>
      <g fill="#C77E0C">
        <circle cx="12.2" cy="6.5" r=".6" />
        <circle cx="7" cy="9.2" r=".6" />
        <circle cx="17" cy="8.3" r=".6" />
      </g>
    </>
  ),
  cotton: (
    <>
      <path d="M12 13L2 14.5l5.5 2.3-1.8 5 6.3-2.5 6.3 2.5-1.8-5 5.5-2.3z" fill="#7B4F2C" />
      <g fill="#FFFFFF" stroke="#C9C1B1" strokeWidth=".8">
        <circle cx="12" cy="7" r="4.2" />
        <circle cx="7.4" cy="10.8" r="3.9" />
        <circle cx="16.6" cy="10.8" r="3.9" />
        <circle cx="12" cy="13.2" r="4" />
      </g>
    </>
  ),
  sugarcane: (
    <>
      <g transform="rotate(15 12 13)">
        <path d="M7.6 21.5V9M12 22V6.5M16.4 21.5V9.5" stroke="#8A2D52" strokeWidth="3" />
        <path
          d="M6.1 17.8h3M6.1 13.4h3M10.5 19.4h3M10.5 15h3M10.5 10.6h3M14.9 17.6h3M14.9 13.4h3"
          stroke="#E8B4C7"
          strokeWidth="1"
        />
      </g>
      <path
        d="M13.6 6.3C11.8 3.9 9 2.6 5.5 2.9c3 1 5.5 2.4 7.4 4.6zM13.6 6.3c1.6-2.3 4-3.6 7.4-3.4-3 .9-5 2.4-6.6 4.6z"
        fill="#4E9A3E"
      />
      <path d="M13.6 6.3c.8-1.8 1-3.6.4-5.3-1 1.6-1.2 3.4-.4 5.3z" fill="#62BF4E" />
    </>
  ),
  guava: (
    <>
      <circle cx="10" cy="11.3" r="6.8" fill="#A3CF55" />
      <ellipse cx="6.8" cy="9.6" rx="1.3" ry="2.1" fill="#E2F5B8" opacity=".9" />
      <path d="M10.3 4.9c.8-1.8 2.6-2.8 4.6-2.6-.8 1.9-2.6 2.9-4.6 2.6z" fill="#3E9A3A" />
      <circle cx="15.3" cy="15.6" r="5.6" fill="#86BD3E" />
      <circle cx="15.3" cy="15.6" r="4.6" fill="#FCE8D8" />
      <circle cx="15.3" cy="15.6" r="2.3" fill="#F9D2BC" />
      <g fill="#C98F5E">
        <circle cx="16.7" cy="15.6" r=".45" />
        <circle cx="15.7" cy="16.9" r=".45" />
        <circle cx="14.2" cy="16.4" r=".45" />
        <circle cx="14.2" cy="14.8" r=".45" />
        <circle cx="15.7" cy="14.3" r=".45" />
      </g>
    </>
  ),
  adzuki: (
    <>
      <g fill="#8E1C2E">
        <ellipse cx="13.2" cy="8.2" rx="3" ry="4.2" transform="rotate(25 13.2 8.2)" />
        <ellipse cx="8" cy="14.5" rx="3" ry="4.2" transform="rotate(-30 8 14.5)" />
        <ellipse cx="16" cy="15.5" rx="3" ry="4.2" transform="rotate(65 16 15.5)" />
      </g>
      <g stroke="#FFF4EE" strokeWidth=".9" strokeLinecap="round">
        <path d="M15.2 6.7v3" transform="rotate(25 13.2 8.2)" />
        <path d="M10 13v3" transform="rotate(-30 8 14.5)" />
        <path d="M18 14v3" transform="rotate(65 16 15.5)" />
      </g>
    </>
  ),
  sesame: (
    <>
      <g fill="#2B2522">
        <path d={SESAME_SEED} transform="translate(6 17.4) rotate(-70)" />
        <path d={SESAME_SEED} transform="translate(13.8 17.9) rotate(95)" />
        <path d={SESAME_SEED} transform="translate(18.2 16.6) rotate(25)" />
        <path d={SESAME_SEED} transform="translate(8.6 12.8) rotate(15)" />
        <path d={SESAME_SEED} transform="translate(16 12.2) rotate(-40)" />
        <path d={SESAME_SEED} transform="translate(12.4 7.8) rotate(60)" />
      </g>
      <g fill="#F1E4C4" stroke="#B9A273" strokeWidth=".6">
        <path d={SESAME_SEED} transform="translate(10 17.6) rotate(-15)" />
        <path d={SESAME_SEED} transform="translate(12.3 12.6) rotate(-110)" />
        <path d={SESAME_SEED} transform="translate(15.2 7.4) rotate(20)" />
      </g>
    </>
  ),
  mushroom: (
    <>
      <path
        d="M3.6 13.3c2.6-1 5.4-1.5 8.4-1.5s5.8.5 8.4 1.5c-2.4 1-5.2 1.4-8.4 1.4s-6-.4-8.4-1.4z"
        fill="#E8D6B4"
      />
      <path
        d="M10.2 13l-.5 6.2c-.1 1.7 4.7 1.7 4.6 0L13.8 13z"
        fill="#F2E8D3"
        stroke="#CDBA95"
        strokeWidth=".8"
      />
      <path
        d="M3.3 13.2C3.3 7.6 7.2 3.8 12 3.8s8.7 3.8 8.7 9.4c-2.6-1.1-5.5-1.6-8.7-1.6s-6.1.5-8.7 1.6z"
        fill="#7C4A2A"
      />
      <g fill="#E4C9A0">
        <ellipse cx="8" cy="8" rx=".9" ry=".5" transform="rotate(-40 8 8)" />
        <ellipse cx="12.5" cy="6.3" rx=".9" ry=".5" />
        <ellipse cx="15.8" cy="8.6" rx=".9" ry=".5" transform="rotate(35 15.8 8.6)" />
        <ellipse cx="10.3" cy="10.3" rx=".8" ry=".45" />
        <ellipse cx="6" cy="11.2" rx=".8" ry=".45" transform="rotate(-20 6 11.2)" />
        <ellipse cx="17.6" cy="11.3" rx=".8" ry=".45" transform="rotate(20 17.6 11.3)" />
        <ellipse cx="13.8" cy="10.2" rx=".8" ry=".45" />
      </g>
    </>
  ),
  cucumber: (
    <>
      <path
        d="M4.3 17.3c-1.2-1.2-.8-3.3.9-4.8l7.8-7.1c2.2-2 5-2.4 6.4-1 1.4 1.4 1 4.2-1 6.4l-7.1 7.8c-1.5 1.7-3.6 2.1-4.8.9z"
        fill="#3F8F3A"
      />
      <path
        d="M6.6 15.6l9.6-9.3"
        stroke="#7BC862"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="#CDEBB4">
        <circle cx="8.6" cy="16" r=".6" />
        <circle cx="12.4" cy="12.8" r=".6" />
        <circle cx="15.8" cy="9.3" r=".6" />
        <circle cx="10.8" cy="10.6" r=".5" />
        <circle cx="14" cy="7.6" r=".5" />
      </g>
      <path d="M19 5l1.7-1.7" stroke="#6B5314" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  carrot: (
    <>
      <path
        d="M16 8.3c1.4 1.5 1.3 3.3-.3 4.9l-9.7 8c-.9.7-2 .1-1.8-1l3.4-11.2c.8-1.9 2.4-2.9 4.2-2.8 1.5 0 3 .8 4.2 2.1z"
        fill="#F08A24"
      />
      <path
        d="M9.6 12.6l1.8.9M8.1 16.3l1.7.8M11.8 9.9l1.4 1"
        stroke="#C4611A"
        strokeWidth=".9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M15.1 7.4c.3-2.6 1.6-4.6 3.8-5.3.3 2.4-1.2 4.4-3.8 5.3zM16.4 8.9c2.3-.8 4.4-.4 5.6 1.2-2.1 1.2-4.3.8-5.6-1.2z"
        fill="#4E9A3E"
      />
      <path d="M15.6 8.2c.9-1 2-1.6 3.3-1.8" stroke="#62BF4E" strokeWidth="1.2" fill="none" />
    </>
  ),
  longbean: (
    <>
      <path
        d="M4.5 3.5c-1 5 1.2 9.3 5.4 11.8 3.7 2.2 7 3.4 9.8 5.9"
        stroke="#3E8F35"
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9.2 2.8c-.6 4.6 1.5 8.1 5.1 10.1 3 1.7 5.2 3.9 6.3 7"
        stroke="#76C35B"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M4.5 3.5l-.7-1.5M9.2 2.8l-.2-1.6"
        stroke="#2E6B2A"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  frenchbean: (
    <>
      <path
        d="M5.4 5.2c2.6 3.4 3.6 7.6 3 12.8-.1 1.2-1.6 1.4-2 .3-1.5-3.8-2-8.3-1-13.1z"
        fill="#3E9A3A"
      />
      <path
        d="M10.6 4.2c2.6 3.4 3.6 7.6 3 12.8-.1 1.2-1.6 1.4-2 .3-1.5-3.8-2-8.3-1-13.1z"
        fill="#62BF4E"
      />
      <path
        d="M15.8 5.2c2.6 3.4 3.6 7.6 3 12.8-.1 1.2-1.6 1.4-2 .3-1.5-3.8-2-8.3-1-13.1z"
        fill="#3E9A3A"
      />
      <path
        d="M11.7 7.8c.9 2 1.3 4.2 1.2 6.6"
        stroke="#A9E08E"
        strokeWidth=".9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M5.4 5.2l-.9-1.5M10.6 4.2l-.9-1.5M15.8 5.2l-.9-1.5"
        stroke="#2E6B2A"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </>
  ),
  ginger: (
    <>
      <path
        d="M3.4 14.7c0-2 1.6-3.1 3.4-2.7.4-1.9 2.2-3 4-2.4.9-2.2 3.4-3 5.2-1.8 1.9-.7 4 .6 4 2.7 0 1.6-1.1 2.8-2.6 3 0 1.9-1.6 3.2-3.4 2.9-1 1.6-3 2-4.4 1-1.5 1-3.6.7-4.5-.9-1-.2-1.7-1-1.7-1.8z"
        fill="#D9A95B"
      />
      <path
        d="M6.8 13.6c1.2.3 2 1.2 2.3 2.4M11.1 10.1c.9.6 1.4 1.5 1.4 2.6M16 8.8c.5.9.6 1.9.2 2.9M13.6 16.3c.8-.5 1.7-.6 2.6-.4"
        stroke="#A8752F"
        strokeWidth=".9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16.2 7.9c.1-1.8 1-3.2 2.5-4"
        stroke="#E07C8A"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M18.7 3.9c.9-.7 2-.9 3-.6-.6 1-1.8 1.4-3 .6z" fill="#4E9A3E" />
    </>
  ),
  lime: (
    <>
      <path d="M8.3 8.2C7.7 5 9.4 2.6 12.6 2c.5 3.2-1.3 5.6-4.3 6.2z" fill="#3E8A2E" />
      <circle cx="12" cy="14" r="8" fill="#4FA33A" />
      <circle cx="12" cy="14" r="6.7" fill="#E4F5B9" />
      <path
        d="M12 7.6v12.8M5.6 14h12.8M7.5 9.5l9 9M16.5 9.5l-9 9"
        stroke="#A6D46A"
        strokeWidth="1"
      />
      <circle cx="12" cy="14" r="1.3" fill="#F4FBE2" />
    </>
  ),
  calamansi: (
    <>
      <path
        d="M11.6 2.8c-.2 2.2-1.2 4-2.8 5.4M11.6 2.8c1 2 2.4 3.4 4.2 4.2"
        stroke="#6B5314"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M11.6 3c2-1.6 4.4-1.7 6.2-.4-2 1.7-4.3 1.8-6.2.4z" fill="#3E9A3A" />
      <circle cx="8.2" cy="12" r="4.1" fill="#F2A23A" />
      <circle cx="16" cy="11" r="3.7" fill="#8DC63F" />
      <circle cx="12.3" cy="17.6" r="3.9" fill="#F7B84B" />
      <g fill="#FFF1D2" opacity=".85">
        <circle cx="6.9" cy="10.6" r=".9" />
        <circle cx="11.1" cy="16.2" r=".9" />
      </g>
      <circle cx="15" cy="9.9" r=".8" fill="#D6F0A8" opacity=".85" />
    </>
  ),
  coconut: (
    <>
      <path d="M3 12.4a9 9 0 0 0 18 0z" fill="#7A4A26" />
      <path d="M4.7 12.4a7.3 7.3 0 0 0 14.6 0z" fill="#FBF6EC" />
      <ellipse cx="12" cy="12.4" rx="9" ry="1.9" fill="#8B5A30" />
      <ellipse cx="12" cy="12.4" rx="7.3" ry="1.2" fill="#F1E6D2" />
      <path
        d="M7.6 8.8l1 1.6M11.6 7.2l.2 1.9M15.6 8.4l-.8 1.6M13.9 4.9l-.3 1.4M9.6 5.3l.6 1.3"
        stroke="#D8C7A6"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  oil: (
    <>
      <path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" fill="#E8B92F" />
      <path
        d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"
        stroke="#FFF3C4"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  box: (
    <>
      <path d="M4 8l8-4 8 4v9l-8 4-8-4z" fill="#8FA3B8" />
      <path d="M4 8l8 4 8-4M12 12v9" stroke="#5E738A" strokeWidth="1.2" fill="none" />
    </>
  ),
  gridc: (
    <>
      <g fill="#4F7BD9">
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" opacity=".55" />
      </g>
    </>
  ),
  clockc: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="#8B6BE0" />
      <path d="M12 7v5l3.5 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
}

export interface CropSvgProps {
  /** A crop id from the API (`onion`) or a category icon (`gridc`); unknown ids get the box. */
  id: string
  className?: string
}

/** A crop's colour illustration; 1em square unless CSS sizes it. */
export function CropSvg({ id, className }: CropSvgProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      {ART[isCropIconId(id) ? id : 'box']}
    </svg>
  )
}
