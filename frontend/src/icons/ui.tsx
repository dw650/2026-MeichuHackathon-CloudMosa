// Interface icons moved from ui-mockup/src/icons.js (docs/03 §8): single-colour line
// drawings on a 24×24 viewBox that follow the text colour, plus the product logo.
import type { ReactElement } from 'react'

import type { UiIconName } from './names'

const ART: Readonly<Record<UiIconName, ReactElement>> = {
  pin: (
    <>
      <path d="M12 21s-6-5.5-6-10.5a6 6 0 0 1 12 0C18 15.5 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </>
  ),
  cal: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 3.5v4M16 3.5v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
    </>
  ),
  speaker: (
    <>
      <path d="M5 9.5h3l4-3.5v12l-4-3.5H5z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  sort: (
    <>
      <path d="M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3" />
    </>
  ),
  moon: (
    <>
      <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  chev: (
    <>
      <path d="M9 5l7 7-7 7" />
    </>
  ),
  check: (
    <>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  refresh: (
    <>
      <path d="M19 8a7.5 7.5 0 1 0 1 6" />
      <path d="M19.5 3.5V8H15" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.3" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </>
  ),
  star: (
    <>
      <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5L5.5 4.5h13L20 9.5M4 9.5h16v10H4zM9 19.5v-5h6v5" />
    </>
  ),
  trend: (
    <>
      <path d="M4 17l5-5 4 3 7-7M15 8h5v5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a2.5 2.5 0 0 0 5 0zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </>
  ),
}

export interface UiIconProps {
  name: UiIconName
  className?: string
}

/** A line icon in the current text colour; 1em square unless CSS sizes it. */
export function UiIcon({ name, className }: UiIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ART[name]}
    </svg>
  )
}

/** The product logo: a leaf with a price tag, on a 48×48 viewBox. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="1em" height="1em" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#146C43" />
      <path d="M14 33c0-11 8-19 21-19 0 13-8 21-19 21" fill="#9BE07A" />
      <path
        d="M14 35c5-6 10-10 17-14"
        stroke="#146C43"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M27 30h9l3 3-3 3h-9z" fill="#FFC53D" />
      <circle cx="29.5" cy="33" r="1.2" fill="#146C43" />
    </svg>
  )
}
