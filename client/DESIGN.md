# Tibb Assist — Design System

Warm, whimsical, pregnancy-care design language built on **React 19 + Vite 8 + Tailwind v4**.

## Design Principles

| Principle | Meaning |
|---|---|
| **Human & supportive** | Georgia headings, warm palette, soft corners — feels like a caring friend, not a dashboard. |
| **Whimsical but calm** | Gentle CSS float animations, soft gradients, friendly SVG illustrations. |
| **Clear progress** | Step bars, timelines, progress rings and risk badges make every stage visible. |
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
│   ├── AppLayout.jsx     ← Shell: sticky header (brand mark + wordmark) + sidebar + main
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
| `--teal-900` | `#155E52` | Deep brand, gradients, headings |
| `--teal-700` | `#1D7568` | Primary brand, links, focus rings |
| `--teal-600` | `#268A7A` | Hover state |
| `--teal-500` | `#319E8C` | Mid teal, focus outlines |
| `--teal-400` | `#5CB8A7` | Light teal accent |
| `--teal-200` | `#B4DDD4` | Decorative strokes |
| `--teal-100` | `#D9F0EB` | Tint surfaces |
| `--teal-50` | `#EDF8F5` | Subtle teal background |
| `--amber-700` | `#8B6914` | Dark gold text |
| `--amber-500` | `#D4A024` | Accent, warm highlights, eyebrow bars |
| `--amber-400` | `#E2B94E` | Illustration accent |
| `--amber-200` | `#F0D98A` | Decorative gold |
| `--amber-50` | `#FDF6E3` | Warm tint surfaces |
| `--coral-500` | `#D9716A` | Recording indicators, warm accents |
| `--coral-400` | `#E49088` | Illustration fills |
| `--lavender-500` | `#8878B0` | Secondary accent |
| `--lavender-100` | `#EBE8F4` | Facility-selected surfaces |
| `--sage-700` | `#4A6B50` | Warm green accent |
| `--sage-500` | `#6B9B72` | Mid sage |
| `--sage-300` | `#9FBEA1` | Card hover border |
| `--sage-100` | `#DEEDDF` | Status surfaces |
| `--sage-50` | `#EFF6EF` | Action icon background |
| `--bg-page` | `#FAF8F4` | Page background |
| `--bg-card` | `#FFFFFF` | Card surfaces |
| `--bg-subtle` | `#F0EDE7` | Muted surfaces |
| `--bg-input` | `#FDFCF9` | Form input background |
| `--border-soft` | `#E2DDD5` | Default borders |
| `--border-input` | `#D1CBC1` | Form input borders |
| `--text-primary` | `#1E2D2A` | Headings, primary text |
| `--text-secondary` | `#4A5C56` | Body text |
| `--text-muted` | `#6E7F78` | Muted labels, timestamps |
| `--text-inverse` | `#FFFFFF` | On-dark text |
| `--risk-green-*` | `#1A6B4E` / `#E2F5EC` / `#B3DCCA` | Low-risk badges (fg / bg / ring) |
| `--risk-amber-*` | `#8A6518` / `#FEF1DA` / `#EED9A8` | Moderate-risk badges |
| `--risk-red-*` | `#9B2C2C` / `#FDE8E8` / `#F5B8B8` | Emergency-risk badges |

### Typography

- **Display:** `Georgia, 'Times New Roman', 'Noto Serif', serif` (`--font-display`) — headings and brand warmth
- **Body:** `'Inter', ui-sans-serif, system-ui, sans-serif` (`--font-body`) — UI text and readability
- **Urdu:** `'Noto Nastaliq Urdu', serif` (`--font-urdu`) — RTL/Urdu content, larger base size (×1.05), 2.2 line-height
- **Scale:** `xs` (12px) → `sm` (13px) → `base` (15px) → `lg` (17px) → `xl` (20px) → `2xl` (26px) → `3xl` (36px) → `4xl` (clamp 36–52px)

### Radii, Shadows, Transitions

- **Radii:** `sm` (8px), `md` (12px), `lg` (16px), `xl` (20px), `2xl` (28px), `full` (999px)
- **Shadows:** `xs` → `xl`, plus `glow-teal`, `glow-amber`, `warm`, and `soft` for depth effects
- **Transitions:** `ease-out`, `ease-spring`, `duration-fast` (150ms), `normal` (250ms), `slow` (400ms)

### Gradients

| Token | Purpose |
|---|---|
| `--gradient-warm` | Button primary gradient (teal-700 → teal-900 → deep) |
| `--gradient-hero` | Hero card background (teal-tint → cream → amber-tint) |
| `--gradient-auth` | Login/register shell (teal-100 → warm cream → coral-50) |
| `--gradient-card-warm` | Tinted card background (teal-50 → amber-50) |
| `--gradient-risk-green/amber/red` | Risk result hero backgrounds |

## Components (`src/App.css`)

### Buttons

```css
.button-primary   /* Pill, gradient (teal-900→teal-700), shadow glow, hover lift */
.button-secondary /* Light bg + colored border, ghost style */
.link-button      /* Underlined link with teal focus */
```

### Cards

| Class | Purpose |
|---|---|
| `.hero-card` | Full-width gradient hero with amplified radial decorative blobs |
| `.content-panel` | Standard card: white, soft shadow, gradient top accent, hover lift |
| `.content-panel.panel-editing` | Edit-mode emphasis with teal border + glow |
| `.compact-card` | Tight stats/action cards, soft shadow, hover lift |
| `.tinted-card` | Warm gradient background, soft shadow, hover lift |

### Forms

```css
.form-label  /* Grid gap label */
.form-input  /* Large, rounded-md, teal focus ring, warm background */
select.form-input  /* Custom stroked chevron, mirrored for RTL */
```

### Risk Badges

```css
.risk-badge              /* Base pill badge */
.risk-green / .risk-yellow / .risk-red  /* Color variants */
.risk-result-hero        /* Large result banner with icon and gradient bg */
```

### Step Indicators

```css
.step-bar              /* Horizontal flex container */
.step-dot              /* 32px circle: numbered */
.step-dot-active       /* Teal filled + amber glow */
.step-dot-done         /* Teal filled (completed) */
.step-connector        /* Horizontal line between dots */
```

### GA Progress Ring

```css
.ga-ring               /* 220px grid container, centers SVG + text overlay */
.ga-ring-track         /* Background SVG circle (border-soft stroke) */
.ga-ring-fill          /* Progress arc: teal→amber gradient stroke + drop-shadow */
.ga-ring-center        /* Absolute-positioned text stack */
.ga-ring-week          /* Large week number (clamp 2.25–2.75rem) */
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
.status-facility_contacted  /* Teal-50/teal-900 */
.status-transport_arranged  /* Teal-100/teal-700 */
.status-patient_departed    /* Sage-100/sage-700 */
.status-patient_arrived     /* Deep sage */
.status-follow_up_due       /* Warm amber */
.status-closed         /* Green */
.status-cancelled      /* Gray */
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
| `MapPinIcon` | Nearby facilities (large) |
| `HistoryIcon` | Assessment history action card |
| `LocationIcon` | Nearby facilities action card (smaller pin) |
| `ChatBubbleIcon` | AI assistant contexts |
| `CalendarIcon` | Check-in / appointments |
| `PhoneIcon` | Emergency contact / call contexts |
| `UserIcon` | Profile/user contexts |
| `ChevronRightIcon` | Navigation chevrons |
| `BrandMark` | Header logo mark and favicon (teal gradient + amber arc) |
| `PregnancyHeroIllustration` | Large dashboard hero illustration (mother & belly composition) |

All illustrations use CSS custom properties for fills and strokes, making them themeable.

## RTL Support

RTL overrides use `html[dir="rtl"]` selectors to mirror:
- Chat bubbles (assistant/user swap sides)
- Card text alignment
- Navigation items (Urdu font, larger size)
- Form select dropdown arrow position
- Border-inline-start colored strips
- Typography: Urdu font, no letter-spacing, no text-transform on eyebrows/badges

All layout uses logical properties (`inset-inline-start/end`, `border-inline-start`, `padding-inline-end`) for automatic RTL mirroring.

## Animations

| Keyframe | Purpose |
|---|---|
| `fade-in` | 250ms slide-up entrance |
| `pulse-soft` | Typing indicator, recording dot |
| `shimmer` | Skeleton loading shimmer |
| `float-gentle` | 6s translateY loop for hero illustration |
| `rise` | Staggered translateY entrance for action cards |
| `result-reveal` | Assessment result hero scale-in |

All animations use `transform`/`opacity` only for GPU-accelerated performance.

`prefers-reduced-motion: reduce` disables all animations and hover transforms for accessibility.
