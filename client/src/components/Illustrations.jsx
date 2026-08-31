/**
 * Lightweight SVG illustrations for Tibb Assist.
 * All illustrations use CSS custom properties for theming,
 * and are designed to feel warm, hand-drawn and whimsical.
 */

/** Small heart icon — for pregnancy/love contexts */
export function HeartIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 12 5C12.09 3.81 13.76 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14 12 21 12 21Z"
        fill="var(--coral-400)" stroke="var(--coral-500)" strokeWidth="1"/>
    </svg>
  )
}

/** Shield icon — for risk/safety contexts */
export function ShieldIcon({ size = 20, color = 'var(--teal-700)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z"
        fill={color} opacity="0.2" stroke={color} strokeWidth="1.5"/>
      <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/** Alert triangle — for emergency/warning contexts */
export function AlertIcon({ size = 20, color = 'var(--risk-red-fg)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M12 2L1 21H23L12 2Z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="12" y1="9" x2="12" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1" fill={color}/>
    </svg>
  )
}

/** Baby/stork icon — for pregnancy empty states */
export function BabyIcon({ size = 28 }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="14" r="10" fill="var(--amber-100)" stroke="var(--amber-400)" strokeWidth="1.5"/>
      <circle cx="13" cy="12" r="1.5" fill="var(--teal-900)"/>
      <circle cx="19" cy="12" r="1.5" fill="var(--teal-900)"/>
      <path d="M13 17 Q16 20 19 17" stroke="var(--teal-900)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M16 4 Q18 2 20 4" stroke="var(--amber-400)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

/** Clipboard icon — for assessment contexts */
export function ClipboardIcon({ size = 28 }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" width={size} height={size} aria-hidden="true">
      <rect x="6" y="4" width="20" height="24" rx="3" fill="var(--teal-50)" stroke="var(--teal-400)" strokeWidth="1.5"/>
      <rect x="11" y="2" width="10" height="5" rx="2" fill="var(--teal-200)" stroke="var(--teal-400)" strokeWidth="1"/>
      <line x1="10" y1="14" x2="22" y2="14" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="19" x2="18" y2="19" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="24" x2="20" y2="24" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

/** Map pin icon — for nearby facilities */
export function MapPinIcon({ size = 28 }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M16 2C10.48 2 6 6.48 6 12C6 19.5 16 30 16 30C16 30 26 19.5 26 12C26 6.48 21.52 2 16 2Z"
        fill="var(--coral-100)" stroke="var(--coral-500)" strokeWidth="1.5"/>
      <circle cx="16" cy="12" r="4" fill="var(--coral-500)" opacity="0.6"/>
    </svg>
  )
}
