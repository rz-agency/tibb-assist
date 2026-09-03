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

/** History/clock icon — for assessment history */
export function HistoryIcon({ size = 20, color = 'var(--teal-700)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
      <path d="M12 7V12L15 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.5 12a8.5 8.5 0 0 1 2.2-5.7" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0"/>
    </svg>
  )
}

/** Location/pin icon (smaller than MapPin, for action cards) */
export function LocationIcon({ size = 20, color = 'var(--coral-500)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M12 2C7.58 2 4 5.58 4 10C4 15.5 12 22 12 22C12 22 20 15.5 20 10C20 5.58 16.42 2 12 2Z"
        fill={color} opacity="0.18" stroke={color} strokeWidth="1.5"/>
      <circle cx="12" cy="10" r="3" fill={color}/>
    </svg>
  )
}

/** Chat bubble icon — for AI assistant */
export function ChatBubbleIcon({ size = 20, color = 'var(--teal-700)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M4 5C4 3.9 4.9 3 6 3H18C19.1 3 20 3.9 20 5V14C20 15.1 19.1 16 18 16H9L5 20V16H6H4V5Z"
        fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="9" cy="9.5" r="1" fill={color}/>
      <circle cx="12.5" cy="9.5" r="1" fill={color}/>
      <circle cx="16" cy="9.5" r="1" fill={color}/>
    </svg>
  )
}

/** Calendar icon — for check-in / appointments */
export function CalendarIcon({ size = 20, color = 'var(--teal-700)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2.5" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
      <path d="M3 10H21" stroke={color} strokeWidth="1.5"/>
      <path d="M8 3V7M16 3V7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <rect x="7" y="13" width="3" height="3" rx="0.5" fill={color}/>
      <rect x="14" y="13" width="3" height="3" rx="0.5" fill={color} opacity="0.5"/>
    </svg>
  )
}

/** Phone icon — for emergency / call actions */
export function PhoneIcon({ size = 20, color = 'var(--risk-red-fg)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M5 4H9L11 9L8.5 10.5C9.57 12.67 11.33 14.43 13.5 15.5L15 13L20 15V19C20 20.1 19.1 21 18 21C9.72 21 3 14.28 3 6C3 4.9 3.9 4 5 4Z"
        fill={color} opacity="0.18" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

/** User/profile icon */
export function UserIcon({ size = 20, color = 'var(--teal-700)' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill={color} opacity="0.18" stroke={color} strokeWidth="1.5"/>
      <path d="M4 21C4 17.13 7.58 14 12 14C16.42 14 20 17.13 20 21" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

/** Chevron right icon — for navigation affordance */
export function ChevronRightIcon({ size = 16, color = 'var(--text-muted)' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M6 3L11 8L6 13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/** Brand mark — tiny logo glyph for header / auth */
export function BrandMark({ size = 32 }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="brandMarkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--teal-700)"/>
          <stop offset="100%" stopColor="var(--teal-900)"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#brandMarkGrad)"/>
      <path d="M13 20C13 15 17 12 20 12C23 12 27 15 27 20C27 24 24 27 20 27"
        stroke="var(--amber-400)" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
      <circle cx="20" cy="20" r="2.2" fill="var(--amber-400)"/>
      <path d="M14 11C15.5 9 18 8 20 8" stroke="var(--teal-200)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
    </svg>
  )
}

/** Large pregnancy hero illustration — a stylised mother-and-belly composition */
export function PregnancyHeroIllustration() {
  return (
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <linearGradient id="heroDress" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--teal-500)"/>
          <stop offset="100%" stopColor="var(--teal-900)"/>
        </linearGradient>
        <radialGradient id="heroGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="var(--amber-200)" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="var(--amber-200)" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* ambient glow */}
      <circle cx="120" cy="110" r="100" fill="url(#heroGlow)"/>
      {/* leaf accents */}
      <path d="M30 60 Q45 40 65 55 Q55 70 40 70 Z" fill="var(--sage-200)" opacity="0.7"/>
      <path d="M195 170 Q210 150 220 165 Q215 185 195 185 Z" fill="var(--sage-200)" opacity="0.7"/>
      {/* mother silhouette */}
      <circle cx="120" cy="70" r="22" fill="var(--coral-100)" stroke="var(--coral-400)" strokeWidth="1.5"/>
      <path d="M105 66 Q110 58 120 60 Q132 60 135 70 Q132 78 125 78 Q118 78 115 74" fill="#3d2a20" opacity="0.85"/>
      <circle cx="114" cy="72" r="1.2" fill="#3d2a20"/>
      <circle cx="126" cy="72" r="1.2" fill="#3d2a20"/>
      <path d="M116 78 Q120 81 124 78" stroke="#a8594c" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      {/* body / dress with belly curve */}
      <path d="M95 92
               Q120 88 145 92
               Q160 130 158 170
               Q150 200 120 205
               Q90 200 82 170
               Q80 130 95 92 Z"
            fill="url(#heroDress)"/>
      {/* belly highlight */}
      <path d="M105 135
               Q120 120 138 135
               Q145 160 125 175
               Q108 170 105 155 Z"
            fill="var(--amber-400)" opacity="0.55"/>
      {/* hands cradling */}
      <ellipse cx="108" cy="150" rx="7" ry="5" fill="var(--coral-100)"/>
      <ellipse cx="135" cy="150" rx="7" ry="5" fill="var(--coral-100)"/>
      {/* tiny heart above belly */}
      <path d="M120 118 C120 118 115 114 115 111 C115 109 117 108 118 109 C119 108 121 109 121 111 C121 109 123 108 124 109 C125 108 127 109 127 111 C127 114 122 118 122 118 Z"
            fill="var(--coral-400)"/>
      {/* sparkle stars */}
      <g fill="var(--amber-400)">
        <circle cx="45" cy="100" r="2"/>
        <circle cx="200" cy="90" r="1.8"/>
        <circle cx="185" cy="200" r="2.2"/>
        <circle cx="55" cy="180" r="1.6"/>
      </g>
    </svg>
  )
}
