# Tibb Assist — Design System

Warm, whimsical, pregnancy-care design language built on **React 19 + Vite 8 + Tailwind v4**.

## Design Principles

| Principle | Meaning |
|---|---|
| **Human & supportive** | Georgia headings, warm palette, soft corners — feels like a caring friend, not a dashboard. |
| **Whimsical but calm** | Gentle CSS float animations, soft gradients, friendly SVG illustrations. |
| **Clear progress** | Step bars, timelines, progress bars and risk badges make every stage visible. |
| **Varied layouts** | Hero sections, tinted cards, compact stats, action grids — never the same white card everywhere. |
| **Mobile-first** | Responsive grids, vertically stacking timelines, comfortable touch targets. |

## File Structure

```
src/
├── styles/
│   └── tokens.css       ← CSS custom properties (colors, spacing, radii, shadows)
├── index.css             ← Tailwind v4 import + base reset + animations
├── App.css               ← Component design system (buttons, cards, forms, risk, timelines…)
├── components/
│   ├── Illustrations.jsx ← Lightweight SVG illustrations & icons
│   ├── AppLayout.jsx     ← Shell: sticky header + sidebar + main
│   ├── EmergencyContacts.jsx
│   ├── LanguageSwitcher.jsx
│   └── StatusMessage.jsx
└── pages/
    ├── Login.jsx / Register.jsx
    ├── Dashboard.jsx / LhwDashboard.jsx
    ├── AssessmentPage.jsx / AssessmentHistory.jsx
    ├── PregnancyPage.jsx
    ├── AiAssistantPage.jsx
    ├── CareMissionPage.jsx / ReferralJourneyPage.jsx
    └── NearbyFacilitiesPage.jsx
```

## Tokens (`src/styles/tokens.css`)

All design tokens are CSS custom properties on `:root`.

### Colors

| Token | Hex | Usage |
|---|---|---|
| `--teal-700` | `#147d70` | Primary brand, links, focus rings |
| `--bg-page` | `#faf6f0` | Page background |
| `--bg-card` | `#ffffff` | Card surfaces |
| `--amber-500` | `#e2a65d` | Accent, warm highlights |
| `--coral-500` | `#e07a6a` | Recording indicators, warm accents |
| `--lavender-500` | `#8b7ab8` | Secondary accent |
| `--risk-green-*` | | Low-risk badges |
| `--risk-amber-*` | | Moderate-risk badges |
| `--risk-red-*` | | Emergency-risk badges |

### Typography

- **Display:** `Georgia, 'Times New Roman', serif` (`--font-display`) — headings and brand warmth
- **Body:** `'Inter', system-ui, sans-serif` (`--font-body`) — UI text and readability
- **Scale:** `xs` (12px) → `sm` (13px) → `base` (15px) → `lg` (17px) → `xl` (20px) → `2xl` (26px) → `3xl` (36px) → `4xl` (clamp 36–52px)

### Radii, Shadows, Transitions

- **Radii:** `sm` (8px), `md` (12px), `lg` (16px), `xl` (20px), `2xl` (28px), `full` (999px)
- **Shadows:** `xs` → `xl`, plus `glow-teal` and `glow-amber` for button hover effects
- **Transitions:** `ease-out`, `ease-spring`, `duration-fast` (150ms), `normal` (250ms), `slow` (400ms)

## Components (`src/App.css`)

### Buttons

```css
.button-primary   /* Pill, gradient, shadow glow, hover lift */
.button-secondary /* Light bg + colored border, ghost style */
.link-button      /* Underlined link with teal focus */
```

### Cards

| Class | Purpose |
|---|---|
| `.hero-card` | Full-width gradient hero with subtle radial background |
| `.content-panel` | Standard card: white, soft shadow, rounded-xl |
| `.compact-card` | Tight stats/action cards |
| `.tinted-card` | Warm gradient background |

### Forms

```css
.form-label  /* Grid gap label */
.form-input  /* Large, rounded-md, teal focus ring */
```

### Risk Badges

```css
.risk-badge              /* Base pill badge */
.risk-green / .risk-yellow / .risk-red  /* Color variants */
.risk-result-hero        /* Large result banner with icon */
```

### Step Indicators

```css
.step-bar              /* Horizontal flex container */
.step-dot              /* 32px circle: numbered */
.step-dot-active       /* Teal filled + glow */
.step-dot-done         /* Teal filled + checkmark */
.step-connector        /* Horizontal line between dots */
```

### Timelines

- **Referral timeline** (horizontal): `.referral-timeline-steps`, `.referral-step`, `.referral-step-dot`
- **Care mission timeline** (vertical): `.cm-timeline`, `.cm-timeline-entry`, `.cm-timeline-dot`, `.cm-timeline-line`

### AI Chat

```css
.ai-chat-panel         /* Rounded container with shadow */
.ai-bubble-assistant   /* Teal-tinted left bubble */
.ai-bubble-user        /* Gradient right bubble */
.ai-typing             /* Three-dot pulsing indicator */
.ai-input-bar          /* Bottom input with mic button */
```

### Status Badges

```css
.status-badge          /* Base pill */
.status-recommended    /* Amber */
.status-facility_selected  /* Lavender */
.status-closed         /* Green */
.status-cancelled      /* Gray */
/* … and more per referral lifecycle stage */
```

## Illustrations (`src/components/Illustrations.jsx`)

Lightweight, CSS-variable-themed SVGs:

| Component | Usage |
|---|---|
| `HeartIcon` | Pregnancy contexts |
| `ShieldIcon` | Risk/safety contexts |
| `AlertIcon` | Warning/emergency contexts |
| `BabyIcon` | Pregnancy empty states |
| `ClipboardIcon` | Assessment empty states |
| `MapPinIcon` | Nearby facilities |

All illustrations use CSS custom properties for fills and strokes, making them themeable.

## RTL Support

RTL overrides use `html[dir="rtl"]` selectors in App.css to mirror:
- Chat bubbles (assistant/user swap sides)
- Card text alignment
- Navigation items
- Form select dropdown arrow position
- Border-inline-start colored strips

## Animations

| Keyframe | Purpose |
|---|---|
| `fade-in` | 250ms slide-up entrance |
| `pulse-soft` | Typing indicator, recording dot |
| `shimmer` | Skeleton loading shimmer |

All animations use `transform`/`opacity` only for GPU-accelerated performance.
