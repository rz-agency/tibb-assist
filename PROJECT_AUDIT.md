# Tibb Assist — Complete Project Audit

> Generated: 2026-09-06 · Read-only analysis, no files modified

---

## 1. Project Identity

| Attribute | Detail |
|---|---|
| **Project name** | Tibb Assist |
| **Purpose** | Maternal-health companion for pregnant women and Lady Health Workers (LHWs) in Pakistan |
| **Main problem** | Limited access to antenatal risk screening, referral tracking, and LHW workload management in rural/semi-rural settings |
| **Target users** | Pregnant women (role `WOMAN`), Lady Health Workers (role `LHW`), Supervisors (role `ADMIN`) |
| **User roles** | `WOMAN`, `LHW`, `ADMIN` (enum `UserRole` in Prisma) |

### Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19.2, Vite 8.2, Tailwind CSS 4.3, i18next (EN/UR with RTL) |
| **Backend** | Node.js, Express 4.21 |
| **Database** | MySQL (via `DATABASE_URL`) |
| **ORM** | Prisma 5.22 |
| **Authentication** | `express-session` with bcryptjs (cost 12), cookie-based sessions |
| **AI integration** | OpenRouter API (minimax-m3 for conversation/symptom extraction, whisper-large-v3 for speech-to-text) |
| **Maps / location** | OpenStreetMap Overpass API (facility lookup), browser Geolocation, haversine distance |
| **Push notifications** | Web Push (VAPID keys), service worker |
| **SMS (optional)** | Twilio (no-op when unconfigured) |
| **Rate limiting** | `express-rate-limit` (auth + AI endpoints) |
| **Linting** | Oxlint |

---

## 2. Complete Project Structure

```
tibb-assist-fresh/
├── client/                          # React SPA
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── api/api.js               # Centralized API layer (40+ exports)
│   │   ├── assets/hero.png
│   │   ├── components/
│   │   │   ├── AppLayout.jsx         # Role-based nav + header shell
│   │   │   ├── AssessmentResultSection.jsx  # Shared risk-result display
│   │   │   ├── EmergencyContacts.jsx # CRUD for emergency contacts
│   │   │   ├── EmergencyPanel.jsx    # RED-risk emergency call panel
│   │   │   ├── Illustrations.jsx     # SVG icons / brand mark
│   │   │   ├── LanguageSwitcher.jsx  # EN ↔ UR toggle
│   │   │   ├── NearbyFacilityList.jsx # Facility selector with GPS fallback
│   │   │   └── StatusMessage.jsx     # Reusable toast/message
│   │   ├── hooks/
│   │   │   └── useNearbyFacilitySearch.js  # Geolocation + API hook
│   │   ├── i18n/
│   │   │   ├── config.js            # i18next setup
│   │   │   ├── en.json              # English translations
│   │   │   └── ur.json              # Urdu translations
│   │   ├── pages/
│   │   │   ├── AdminDashboardPage.jsx  # ADMIN: LHW overview table
│   │   │   ├── AiAssistantPage.jsx     # WOMAN: conversational AI
│   │   │   ├── AssessmentHistory.jsx   # WOMAN: past assessments
│   │   │   ├── AssessmentPage.jsx      # WOMAN/LHW: symptom form
│   │   │   ├── CareMissionPage.jsx     # WOMAN/LHW: care missions
│   │   │   ├── Dashboard.jsx           # WOMAN: main dashboard
│   │   │   ├── LhwDashboard.jsx        # LHW: workspace + patient mgmt
│   │   │   ├── Login.jsx
│   │   │   ├── MonthlyReportPage.jsx   # LHW/ADMIN: print report
│   │   │   ├── NearbyFacilitiesPage.jsx
│   │   │   ├── PatientDetailPage.jsx   # LHW: consolidated timeline
│   │   │   ├── PregnancyPage.jsx       # WOMAN: pregnancy management
│   │   │   ├── ProfilePage.jsx         # WOMAN: profile editor
│   │   │   ├── ReferralJourneyPage.jsx # Referral tracking
│   │   │   ├── Register.jsx
│   │   │   └── WeeklyCheckInPage.jsx   # WOMAN: weekly check-in
│   │   ├── styles/tokens.css        # Design tokens
│   │   ├── utils/riskLabels.js      # Risk label constants
│   │   ├── App.jsx                  # Root component + routing
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx                 # Entry + service worker
│   ├── vite.config.js               # Proxy /api → :3001
│   └── package.json
│
├── server/                          # Express backend
│   ├── prisma/
│   │   ├── schema.prisma            # 536-line schema (20 models, 15 enums)
│   │   ├── seed.js                  # Demo data seeder
│   │   └── migrations/              # 18 migration folders
│   ├── src/
│   │   ├── controllers/             # 17 controllers
│   │   ├── routes/                  # 17 route files
│   │   ├── lib/                     # 17 services + tests (34 files total)
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js     # requireAuth, requireRole, requireSelf
│   │   │   └── rateLimiters.js       # Auth + AI rate limits
│   │   ├── app.js                   # Express setup + route mounting
│   │   └── server.js                # Entry point
│   ├── seed-admin.js                # One-off ADMIN user creator
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## 3. Frontend Audit

### Pages (16 total)

| Page | Role | Purpose | API calls | Data | Status |
|---|---|---|---|---|---|
| **Login** | — | Email/password login | `loginUser` | Real | ✅ Complete |
| **Register** | — | Account creation (WOMAN/LHW) | `registerUser` | Real | ✅ Complete |
| **Dashboard** | WOMAN | Pregnancy summary, gestational ring, check-in reminder, emergency contacts, referrals, care missions, immunizations, home visits | `getPatientProfile`, `getReferrals`, `getCareMissions`, `getCheckInDue`, `getHomeVisits`, `getImmunizations`, `updatePatientProfile` | Real | ✅ Complete |
| **AssessmentPage** | WOMAN/LHW | Symptom selection + severity, risk result, referral creation | `getSymptoms`, `getPatientProfile`, `getPregnancies`, `createAssessment`, `createReferral` | Real | ✅ Complete |
| **AssessmentHistory** | WOMAN | List + detail view of past assessments | `getAssessments`, `getAssessment` | Real | ✅ Complete |
| **PregnancyPage** | WOMAN | Pregnancy CRUD, ANC visit logging | `getPregnancies`, `createPregnancy`, `updatePregnancy`, `getAncVisits`, `createAncVisit` | Real | ✅ Complete |
| **AiAssistantPage** | WOMAN | Conversational AI (text + voice), symptom extraction, assessment creation | `sendAiMessage`, `confirmAiAssessment` | Real (OpenRouter) | ✅ Complete |
| **WeeklyCheckInPage** | WOMAN | Trimester-specific questions, routes concerning answers to assessment | `getCheckInQuestions`, `getCheckInDue`, `submitCheckIn` | Real | ✅ Complete |
| **CareMissionPage** | WOMAN/LHW | Care mission list + detail, checklist toggling, timeline | `getCareMissions`, `getCareMission`, `updateChecklistItem` | Real | ✅ Complete |
| **ReferralJourneyPage** | WOMAN/LHW | Referral lifecycle tracking, status advancement, cancellation | `getReferrals`, `getReferral`, `updateReferralStatus` | Real | ✅ Complete |
| **NearbyFacilitiesPage** | Any | Geolocation-based facility search with GPS-denied fallback | `useNearbyFacilitySearch` hook → `getNearbyFacilities` | Real (OSM) | ✅ Complete |
| **ProfilePage** | WOMAN | Personal info + emergency contact editor | `getPatientProfile`, `updatePatientProfile`, `getEmergencyContacts`, CRUD | Real | ✅ Complete |
| **LhwDashboard** | LHW | Follow-up queue, stats strip, patient assignment, ANC/home visit/immunization logging, search/filter/group | 15+ API calls | Real | ✅ Complete |
| **PatientDetailPage** | LHW | Consolidated patient timeline (assessments, visits, referrals, etc.) | 6 API calls | Real | ✅ Complete |
| **AdminDashboardPage** | ADMIN | Table of all LHWs with workload stats | `getAdminLhwOverview` | Real | ✅ Complete |
| **MonthlyReportPage** | LHW/ADMIN | Print-friendly monthly summary (visits, assessments, referrals, follow-ups) | `getLhwMonthlyReport` or `getAdminMonthlyReport` | Real | ✅ Complete |

### Components (8 total)

| Component | Purpose | Used by |
|---|---|---|
| **AppLayout** | Role-based sidebar nav + header (logo, email, language, logout) | All authenticated pages |
| **AssessmentResultSection** | Shared risk result display with referral form | AiAssistantPage, WeeklyCheckInPage |
| **EmergencyPanel** | RED-risk emergency call links (1122, contacts, LHW) | AssessmentPage, AiAssistantPage |
| **EmergencyContacts** | CRUD for patient emergency contacts | Dashboard (WOMAN) |
| **Illustrations** | SVG icons (Heart, Shield, Baby, MapPin, BrandMark, etc.) | All pages |
| **LanguageSwitcher** | EN ↔ UR toggle | AppLayout header |
| **NearbyFacilityList** | Facility selector with distance sorting + Google Maps link | AssessmentPage, NearbyFacilitiesPage |
| **StatusMessage** | Success/error message display | All pages |

### Routing

Client-side state-based routing in `App.jsx` via `handleNavigate()`:
- Supports special targets: `monthly-report:userId`, `patient-detail:userId`
- `resolveContent()` dispatches by role → page name
- No react-router dependency

### Navigation

| Role | Nav items |
|---|---|
| ADMIN | Supervisor Dashboard |
| LHW | Assigned Women, Care Missions, Referrals, Nearby |
| WOMAN | Dashboard, AI Assistant, Care Missions, Referrals, Pregnancy, Check-In, Assessment, History, Nearby, Profile |

---

## 4. Backend Audit

### Server Entry & Configuration

- **Entry**: `server/src/server.js` → loads `app.js`, listens on `PORT` (default 3001)
- **CORS**: `FRONTEND_ORIGIN` env var; disabled in dev (Vite proxy handles it)
- **Sessions**: `express-session`, httpOnly cookies, sameSite lax, secure in production, 24h maxAge
- **Rate limiting**: Auth endpoints (20 req/15min), AI endpoints (30 req/min)
- **Body**: JSON with 5MB limit (for audio base64)

### Complete API Endpoint Inventory

#### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| POST | `/auth/register` | No | WOMAN/LHW | Create account + profile (transactional) | ✅ |
| POST | `/auth/login` | No | Any | Email + password login, session regeneration | ✅ |
| POST | `/auth/logout` | Yes | Any | Destroy session, clear cookie | ✅ |
| GET | `/auth/me` | Yes | Any | Return current session user | ✅ |

#### Symptoms & Assessments (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/symptoms` | Yes | WOMAN/LHW | List active symptoms | ✅ |
| GET | `/assessments` | Yes | WOMAN/LHW | List assessments (scoped by role) | ✅ |
| GET | `/assessments/:id` | Yes | WOMAN/LHW | Get single assessment detail | ✅ |
| POST | `/assessments` | Yes | WOMAN/LHW | Create assessment with risk calculation + auto Care Mission | ✅ |

#### Profiles (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/patients/:userId/profile` | Yes | WOMAN+self | Get patient profile | ✅ |
| PUT | `/patients/:userId/profile` | Yes | WOMAN+self | Update patient profile | ✅ |
| GET | `/lhws/:userId/profile` | Yes | LHW+self | Get LHW profile with assigned patients | ✅ |
| PUT | `/lhws/:userId/profile` | Yes | LHW+self | Update LHW profile | ✅ |
| GET | `/lhws/:userId/stats` | Yes | LHW+self | Workload stats (5 aggregates) | ✅ |
| GET | `/lhws/:userId/monthly-report` | Yes | LHW+self / ADMIN | Detailed monthly report | ✅ |

#### Pregnancies (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/pregnancies` | Yes | WOMAN/LHW | List pregnancies (scoped) | ✅ |
| POST | `/pregnancies` | Yes | WOMAN | Create pregnancy with LMP/EDD | ✅ |
| PUT | `/pregnancies/:id` | Yes | WOMAN | Update pregnancy record | ✅ |

#### Referrals (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/referrals` | Yes | WOMAN/LHW | List referrals (scoped) | ✅ |
| GET | `/referrals/:id` | Yes | WOMAN/LHW | Get referral detail + timeline | ✅ |
| POST | `/referrals` | Yes | WOMAN/LHW | Create referral linked to assessment + facility | ✅ |
| PATCH | `/referrals/:id/status` | Yes | WOMAN/LHW | Advance/cancel referral with lifecycle validation | ✅ |

#### Care Missions (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/care-missions` | Yes | WOMAN/LHW | List care missions (scoped) | ✅ |
| GET | `/care-missions/:id` | Yes | WOMAN/LHW | Get care mission detail + checklist + timeline | ✅ |
| PATCH | `/care-missions/:id/checklist-items/:itemId` | Yes | WOMAN/LHW | Toggle checklist item completion | ✅ |
| POST | `/care-missions/:id/emergency-action-log` | Yes | LHW | Log emergency action to timeline | ✅ |

#### Emergency Contacts (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/patients/:patientId/emergency-contacts` | Yes | WOMAN/LHW | List contacts | ✅ |
| POST | `/patients/:patientId/emergency-contacts` | Yes | WOMAN | Create contact | ✅ |
| PUT | `/emergency-contacts/:id` | Yes | WOMAN | Update contact | ✅ |
| DELETE | `/emergency-contacts/:id` | Yes | WOMAN | Delete contact | ✅ |

#### Facilities (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/facilities/nearby` | Yes | Any | OSM-based nearby facility search | ✅ |

#### AI Assistant (`/api/ai-assistant`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| POST | `/ai-assistant/message` | Yes | WOMAN | Send text/audio, get LLM response + symptom extraction | ✅ |
| POST | `/ai-assistant/confirm` | Yes | WOMAN | Confirm extracted symptoms → create assessment | ✅ |

#### Weekly Check-ins (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/checkins/current-questions` | Yes | WOMAN | Get trimester-specific questions | ✅ |
| GET | `/checkins/due` | Yes | WOMAN | Check if check-in is due this week | ✅ |
| POST | `/checkins` | Yes | WOMAN | Submit answers, optionally route to assessment | ✅ |

#### ANC Visits (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/anc-visits` | Yes | WOMAN/LHW | List ANC visits + schedule for pregnancy | ✅ |
| POST | `/anc-visits` | Yes | WOMAN/LHW | Log ANC visit with BP, weight, danger signs | ✅ |
| PUT | `/anc-visits/:id` | Yes | WOMAN/LHW | Update ANC visit | ✅ |

#### Home Visits (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/home-visits` | Yes | WOMAN/LHW | List home visits for patient | ✅ |
| POST | `/home-visits` | Yes | LHW | Log home visit (topics, BP, notes) | ✅ |

#### Immunizations (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/immunizations` | Yes | WOMAN/LHW | List immunizations + TT schedule | ✅ |
| POST | `/immunizations` | Yes | LHW | Log TT dose | ✅ |

#### Follow-ups (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/follow-ups` | Yes | LHW | List follow-ups (pending/completed) | ✅ |
| POST | `/follow-ups/:id/complete` | Yes | LHW | Mark follow-up complete | ✅ |

#### Patient Assignment (`/api`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/patients/unassigned` | Yes | LHW | List patients without an LHW | ✅ |
| PATCH | `/patients/:patientId/assign-lhw` | Yes | LHW | Assign patient to calling LHW | ✅ |

#### Push Notifications (`/api/push`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/push/vapid-public-key` | No | Any | Return VAPID public key | ✅ |
| POST | `/push/subscribe` | Yes | Any | Persist push subscription | ✅ |
| POST | `/push/unsubscribe` | Yes | Any | Remove push subscription | ✅ |

#### Admin (`/api/admin`)

| Method | Endpoint | Auth | Role | Purpose | Status |
|---|---|---|---|---|---|
| GET | `/admin/lhw-overview` | Yes | ADMIN | All LHWs with workload stats | ✅ |
| GET | `/admin/monthly-report/:userId` | Yes | ADMIN | Detailed monthly report for any LHW | ✅ |

#### Health Checks

| Method | Endpoint | Auth | Purpose | Status |
|---|---|---|---|---|
| GET | `/api/health` | No | Server liveness | ✅ |
| GET | `/api/health/db` | No | Database connectivity | ✅ |

### Key Libraries / Services

| Module | Purpose | Real/Mock |
|---|---|---|
| `riskAssessment.js` | Deterministic symptom→risk engine (GREEN/YELLOW/RED) with preterm/postterm rules | ✅ Real |
| `careMissionService.js` | Auto-creates Care Missions + checklists + follow-ups for YELLOW/RED assessments | ✅ Real |
| `referralLifecycle.js` | State machine validating referral status transitions | ✅ Real |
| `qwenService.js` | OpenRouter API (minimax-m3 + whisper) for symptom extraction | ✅ Real (when key set) |
| `placesService.js` | OSM Overpass API for nearby facilities with 10-min cache | ✅ Real |
| `gestationalAge.js` | LMP→gestational week, trimester, EDD (Naegele's rule) | ✅ Real |
| `pushService.js` | Web Push with VAPID + deduplication | ✅ Real (when keys set) |
| `smsService.js` | Twilio SMS (check-in reminders, RED alerts) | 🟡 No-op without env vars |
| `checkInQuestions.js` | Static trimester-specific question sets | ✅ Real |
| `ancVisitSchedule.js` | WHO 8-contact visit schedule builder | ✅ Real |
| `ttSchedule.js` | TT immunization schedule (5 doses) | ✅ Real |
| `followUpService.js` | Auto-creates follow-ups for care missions and referrals | ✅ Real |
| `careMissionAccess.js` | Role-based access filter helpers for care missions | ✅ Real |
| `nearbyFacilityResolver.js` | Find-or-create HealthcareFacility from OSM data | ✅ Real |
| `careMissionTemplates.js` | Default checklist templates for YELLOW/RED risk | ✅ Real |

---

## 5. Database / Prisma Audit

### Models (20 total)

| Model | Table | Purpose | Key Relationships | Active Usage |
|---|---|---|---|---|
| **User** | `users` | Core user account (email, passwordHash, role, isActive) | → PatientProfile?, Lhw?, Assessments[], PushSubscriptions[] | ✅ All flows |
| **PatientProfile** | `patient_profiles` | Patient details (name, phone, DOB, address, blood group, village, district, assignedLhw) | → User, Lhw?, Pregnancies[], Assessments[], Referrals[], HomeVisits[], FollowUps[] | ✅ WOMAN + LHW flows |
| **Pregnancy** | `pregnancies` | Pregnancy records (LMP, due date, gestational week, status) | → PatientProfile, Assessments[], AncVisits[], Immunizations[] | ✅ Pregnancy tracking |
| **Symptom** | `symptoms` | Symptom dictionary (code, name, category, isActive) | → AssessmentSymptom[] | ✅ Assessments |
| **Assessment** | `assessments` | Risk assessments (risk level, result code, input method, triage notes) | → PatientProfile, Pregnancy?, User, AssessmentSymptoms[], Referrals[], CareMission? | ✅ Core feature |
| **AssessmentSymptom** | `assessment_symptoms` | Junction: assessment ↔ symptom (answer status, severity, notes) | → Assessment, Symptom | ✅ Assessments |
| **Lhw** | `lhws` | LHW profile (name, phone, region) | → User, PatientProfiles[], CareMissions[], HomeVisits[], FollowUps[] | ✅ LHW module |
| **HealthcareFacility** | `healthcare_facilities` | Facility records (name, type, location, phone, verified) | → Referrals[] | ✅ Referrals + nearby search |
| **Referral** | `referrals` | Referral records (status, date, notes) | → PatientProfile, Assessment, Facility, CareMission?, StatusHistory[], FollowUps[] | ✅ Referral lifecycle |
| **EmergencyContact** | `emergency_contacts` | Patient emergency contacts (name, relationship, phone, isPrimary) | → PatientProfile | ✅ Emergency features |
| **CareMission** | `care_missions` | Auto-created for YELLOW/RED assessments (risk level, status, assignedLhw) | → Assessment, Referral?, Lhw?, Timeline[], ChecklistItems[], FollowUps[] | ✅ Care missions |
| **CareMissionTimeline** | `care_mission_timelines` | Audit log of care mission actions | → CareMission, User | ✅ Care missions |
| **CareMissionChecklistItem** | `care_mission_checklist_items` | Task checklist per care mission | → CareMission, User? (completer) | ✅ Care missions |
| **ReferralStatusHistory** | `referral_status_history` | Audit log of referral status changes | → Referral, User | ✅ Referral lifecycle |
| **WeeklyCheckIn** | `weekly_check_ins` | Weekly pregnancy check-in answers (JSON, gestational week) | → PatientProfile, Assessment? (routed) | ✅ Weekly check-ins |
| **AncVisit** | `anc_visits` | ANC visit records (visit number, date, BP, weight, danger signs) | → Pregnancy, User (logger) | ✅ ANC visits |
| **HomeVisit** | `home_visits` | LHW home visit logs (type, topics, BP checked, notes) | → PatientProfile, Lhw, User (creator) | ✅ Home visits |
| **Immunization** | `immunizations` | TT immunization records (dose number, date, next dose) | → PatientProfile, Pregnancy?, User (administer) | ✅ Immunizations |
| **FollowUp** | `follow_ups` | Auto-created follow-up tasks (type, due date, status) | → PatientProfile, Lhw, Referral?, CareMission? | ✅ Follow-up queue |
| **PushSubscription** | `push_subscriptions` | Web push endpoints + keys | → User (CASCADE) | ✅ Push notifications |
| **PushNotificationLog** | `push_notification_log` | Deduplication log for sent notifications | → User (CASCADE) | ✅ Push notifications |

### Enums (15 total)
`UserRole`, `PregnancyStatus`, `AssessmentInputMethod`, `RiskLevel`, `AnswerStatus`, `SeverityLevel`, `LhwRegion`, `FacilityType`, `ReferralStatus` (9 states), `CareMissionStatus` (5 states), `CareMissionAction` (18 actions), `HomeVisitType`, `FollowUpType`, `FollowUpStatus`, `NotificationType`

### Schema Assessment
- **No missing models** — all features have corresponding database models
- **No unused models** — every model is actively queried
- **No duplicate structures** — junction tables properly normalized
- **18 migrations** showing incremental, well-named schema evolution

---

## 6. Authentication & User Roles

### How Authentication Works
1. **Registration**: Validates email/password, enforces allowed roles (WOMAN/LHW only), hashes with bcrypt (cost 12), creates User + profile in transaction, sets session
2. **Login**: Finds user by email, compares bcrypt hash, regenerates session ID (prevents session fixation), stores safe user in session
3. **Session**: `express-session`, httpOnly cookie, sameSite lax, secure in production, 24h expiry
4. **Logout**: Destroys session, clears cookie
5. **Password**: Min 8 chars, letters + numbers required

### Roles

| Role | Registration | Permissions | Backend Enforcement |
|---|---|---|---|
| **WOMAN** | ✅ Public | Own profile, assessments, pregnancies, referrals, care missions, check-ins, AI assistant | `requireRole('WOMAN')` + `requireSelf`; access filters scope queries |
| **LHW** | ✅ Public | Own profile, assigned patients' data, home visits, immunizations, follow-ups, stats | `requireRole('LHW')` + `requireSelf`; `assignedLhwId` filter |
| **ADMIN** | ❌ Seed script only | All LHWs overview, monthly reports for any LHW | `requireRole('ADMIN')` on admin routes |

No DOCTOR or HEALTHCARE_WORKER role exists.

---

## 7. Current Feature Inventory

| Feature | Status | Notes |
|---|---|---|
| Registration | ✅ | WOMAN + LHW only |
| Login | ✅ | Session-based |
| User profile | ✅ | WOMAN self-edit |
| Dashboard (WOMAN) | ✅ | Comprehensive |
| AI assistant | ✅ | OpenRouter API |
| Pregnancy tracker | ✅ | Full CRUD |
| LMP / Due date / Week / Trimester | ✅ | All dynamically computed |
| Pregnancy assessment | ✅ | Risk engine |
| Symptoms | ✅ | 8 seeded symptoms |
| Emergency contacts | ✅ | Multi-contact CRUD |
| Location / Nearby hospitals | ✅ | OSM + geolocation |
| Emergency referral | ✅ | 9-state lifecycle |
| Push notifications | ✅ | Web Push + VAPID |
| SMS notifications | 🟡 | No-op without Twilio |
| Weekly check-ins | ✅ | Trimester-specific |
| Health records | ✅ | Consolidated timeline |
| ANC visits | ✅ | WHO schedule |
| Home visits | ✅ | LHW logging |
| Immunizations (TT) | ✅ | 5-dose schedule |
| LHW module | ✅ | Full workspace |
| Patient management | ✅ | Assign + search/filter |
| Reporting | ✅ | Print-friendly monthly reports |
| Admin functionality | ✅ | LHW overview + reports |
| Care missions | ✅ | Auto-created on YELLOW/RED |
| Follow-ups | ✅ | Auto-created, queue view |
| Appointments | ❌ | Not implemented |
| Doctor role | ❌ | Not implemented |

---

## 8. Pregnancy Tracker — Detailed Audit

### Complete Flow
1. WOMAN registers → PatientProfile created
2. Pregnancy created with LMP date → EDD computed (Naegele's: LMP + 280d)
3. Gestational week dynamically calculated: `(today - LMP) / 7` in UTC
4. Trimester determined from week: 1 (≤13), 2 (14–27), 3 (≥28)
5. Dashboard shows gestational progress ring + week number
6. Assessment links to active pregnancy; risk engine considers gestational week
7. Weekly check-in fetches trimester-specific questions
8. ANC visits tracked against WHO 8-contact schedule
9. YELLOW/RED assessments auto-create Care Missions + follow-ups

### All Calculations Are Dynamic (NOT Hardcoded)
- Gestational week, EDD, trimester — recomputed on every request from stored LMP
- Risk level — deterministic engine, never AI-determined
- Preterm (<37w + labor signs → forced RED), postterm (≥42w → YELLOW)
- ANC schedule — computed from LMP using WHO targets
- TT schedule — interval-based from previous doses
- Age risk — DOB-based (<18 or >35 flagged)

### Missing Pregnancy Features
- No week-by-week fetal development content
- No birth plan feature
- No postpartum / PNC module
- No formal appointment scheduling
- Multiple pregnancies supported (ACTIVE/COMPLETED/UNKNOWN status)

---

## 9. Lady Health Worker — Current Status

**LHW functionality IS fully implemented.** Not a stub.

| Feature | Status |
|---|---|
| LHW registration | ✅ Transactional User + Lhw creation |
| LHW profile + edit | ✅ Full CRUD |
| Patient assignment | ✅ Assign + unassigned list |
| Patient search/filter/group | ✅ District + village filters |
| Workload stats | ✅ 5 aggregate counts |
| Follow-up queue | ✅ Overdue/due/upcoming |
| Home visit logging | ✅ LHW-only create |
| ANC visit logging | ✅ Both WOMAN and LHW |
| Immunization logging | ✅ LHW-only create |
| Care mission visibility | ✅ Role-filtered |
| Referral management | ✅ Lifecycle advancement |
| Patient detail timeline | ✅ Consolidated history |
| Monthly report | ✅ Print-friendly |
| Admin overview | ✅ All-LHW stats table |
| Push notifications (RED alerts) | ✅ Sends to assigned LHW |

---

## 10. Emergency Features

| Feature | Implementation | Real/Mock |
|---|---|---|
| Location collection | Browser geolocation | ✅ Real |
| GPS-denied fallback | Manual coordinate entry | ✅ Real |
| Nearby hospital search | OSM Overpass API + 10-min cache | ✅ Real |
| Distance sorting | Haversine formula | ✅ Real |
| Facility phones | OSM data + 6 seeded facilities | ✅ Real format |
| Emergency panel | `tel:` links (1122, contacts, LHW) | ✅ Real protocol |
| Emergency action logging | CareMissionTimeline entries | ✅ Real |
| Emergency referral | Full lifecycle from assessment → facility | ✅ Real |

Missing: real-time ambulance tracking, SMS-to-contacts automation, offline emergency protocol.

---

## 11. AI Assistant

| Attribute | Detail |
|---|---|
| Frontend | Conversational UI, text + voice (SpeechRecognition / MediaRecorder) |
| Backend | `aiAssistantController.js` → `qwenService.js` → OpenRouter API |
| Model | minimax-m3 (conversation), whisper-large-v3 (transcription) |
| Flow | Message → transcribe → extract symptoms → respond → confirm → create assessment |
| History | Client-side only, NOT persisted to DB |
| Safety | AI extracts symptoms only; risk determined by deterministic engine |
| Urgent detection | `urgentIntent` flag triggers EmergencyPanel |
| Env var | `OPENROUTER_API_KEY` (graceful failure without) |
| Rate limit | 30 req/min |

---

## 12. API Frontend/Backend Consistency

**No mismatches found.** All 40+ frontend API functions map to existing backend endpoints. HTTP methods, field names, response structures, and authentication all align correctly.

---

## 13. Bugs & Errors

### CRITICAL / HIGH — None found

### MEDIUM
- Conversation history not persisted (client-side only)
- Seed pregnancy has stale hardcoded LMP date
- SMS service is no-op without Twilio config
- No appointment system

### LOW
- Bcrypt cost mismatch in seed (10 vs 12)
- No client-side route guard (defense in depth)
- `/api/health/db` exposes raw `error.message`
- No pagination on list endpoints

---

## 14. Security Audit

| Area | Status |
|---|---|
| Password storage | ✅ bcrypt cost 12 |
| Session management | ✅ httpOnly, sameSite lax, secure in prod, regeneration |
| Authorization | ✅ requireRole + requireSelf + access filters |
| IDOR protection | ✅ Queries scoped by role |
| Input validation | ✅ Type checks, enum validation |
| Rate limiting | ✅ Auth + AI endpoints |
| CORS | ✅ Restricted to FRONTEND_ORIGIN |
| Secrets | ✅ All in env vars |
| SQL injection | ✅ Prisma parameterized |
| XSS | ✅ React auto-escapes |
| Error leakage | 🟡 `/api/health/db` returns raw errors |
| CSRF | 🟡 SameSite lax only, no token |

---

## 15. Real vs Mock Data

**REAL**: All endpoints connect to Prisma/MySQL. No mock responses. Risk engine, AI, OSM, push are all real services.

**SEEDED (not mock)**: 1 WOMAN, 1 LHW, 1 pregnancy, 1 assessment, 1 referral, 6 facilities, 8 symptoms — real DB records.

**NO-OP**: SMS (no Twilio), Push (no VAPID keys) — gracefully skip.

**NOT PRESENT**: No hardcoded patient data in frontend. No mock API responses. No fake facility lists.

---

## 16. Environment & Setup

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | MySQL connection |
| `SESSION_SECRET` | **Yes** | Session signing |
| `OPENROUTER_API_KEY` | No | AI assistant |
| `FRONTEND_ORIGIN` | No | CORS |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | Push |
| `TWILIO_*` (3 vars) | No | SMS |
| `PORT` | No | Default 3001 |

```bash
# Backend
cd server; npm install
npx prisma migrate deploy; npx prisma generate
npm run seed                    # Optional demo data
node seed-admin.js              # Optional ADMIN user
npm run dev                     # Port 3001

# Frontend
cd client; npm install; npm run dev  # Vite (proxies /api)
```

---

## 17. Development Status Estimates

| Module | % | Rationale |
|---|---|---|
| Authentication | 95% | Complete; missing password reset, email verify, 2FA |
| AI Assistant | 85% | Real OpenRouter; missing conversation persistence, pregnancy context |
| Emergency System | 80% | Real OSM + geolocation; missing SMS automation, offline mode |
| Pregnancy Tracker | 85% | Dynamic calcs + ANC; missing week-by-week content, birth plans, PNC |
| LHW Module | 95% | Comprehensive workspace; missing appointment scheduling |
| Database | 95% | 20 models, proper indexes; solid schema |
| Frontend | 90% | 16 pages, i18n, design system; missing PWA manifest, offline |
| Backend | 95% | 45+ endpoints, access control, transactions; missing pagination |
| Testing | 75% | 621 tests; missing E2E, frontend tests |
| Admin | 80% | Overview + reports; missing analytics, user management, export |

---

## 18–21. Status Lists

### COMPLETED
Auth (registration, login, logout, session fixation prevention, rate limiting), role-based authorization, patient profile management, pregnancy CRUD with dynamic calculations, deterministic risk engine, care mission auto-creation, referral lifecycle (9-state), AI assistant (text + voice), weekly check-ins, LHW workspace, home/ANC visit logging, TT immunization tracking, nearby facility search (OSM), emergency panel, emergency contacts CRUD, push notifications, SMS framework, ADMIN dashboard, monthly reports, i18n (EN/UR), design system, 621 tests, ADMIN seed script.

### PARTIALLY COMPLETE
AI conversation persistence (client-side only), SMS notifications (no-op without Twilio), admin features (no analytics/user management), testing (no E2E/frontend tests), PWA (SW for push only, no manifest/offline), scheduled notification dispatch (no cron).

### NOT IMPLEMENTED
Appointment system, doctor role, password reset, email verification, 2FA, week-by-week pregnancy content, birth plans, postpartum module, server-side data export, in-app notification center, multi-language beyond EN/UR, patient-LHW messaging, analytics dashboard, file/image upload, offline-first, audit logging, API versioning.

### BROKEN
Nothing. All 621 tests pass, client builds cleanly at 73 modules with 0 warnings.

---

## 22. Development Roadmap

### Phase 1 — Stabilize & Harden (2-3 weeks)
Password reset, email verification, Twilio/VAPID production config, CSRF tokens, sanitize health-check errors, bcrypt cost alignment.

### Phase 2 — Complete Pregnancy Tracker (2-3 weeks)
Week-by-week fetal content, birth plans, postpartum/PNC module, pregnancy history for completed pregnancies.

### Phase 3 — Appointment System (2 weeks)
`Appointment` model, booking UI, reminders via push/SMS, scheduled notification dispatch.

### Phase 4 — Admin Enhancements (2 weeks)
User management, analytics dashboard, CSV export, audit logging.

### Phase 5 — Testing & Quality (2 weeks)
Frontend unit tests, E2E tests (Playwright), integration tests against real MySQL.

### Phase 6 — PWA & Offline (1-2 weeks)
Full PWA manifest, offline caching, background sync.

---

## 23. Final Executive Summary

1. **Tibb Assist** is a full-stack maternal health companion for Pakistani pregnant women and Lady Health Workers
2. **Built**: 16 pages, 45+ endpoints, 20 DB models, risk engine, AI assistant, referral lifecycle, care missions, LHW workspace, admin reporting
3. **Fully functional**: Auth, pregnancy tracking (dynamic), risk assessments, care missions, referrals, LHW workspace, home/ANC visits, immunizations, follow-ups, AI assistant, nearby facilities, check-ins, admin overview + monthly reports
4. **Partially functional**: SMS (no Twilio config), push (needs VAPID keys), admin (basic only)
5. **Frontend-only**: Nothing — all pages connect to real backends
6. **Backend-only**: Nothing significant
7. **Mock/placeholder**: Seed data only (real DB records, not mocks)
8. **Broken**: Nothing
9. **Missing**: Appointments, doctor role, password reset, email verification, week-by-week content, birth plans, postpartum module, offline PWA, scheduled jobs, data export, analytics
10. **Pregnancy Tracker**: Full CRUD, dynamic gestational/EDD/trimester calculations, WHO ANC schedule, risk engine with preterm/postterm rules — all server-computed, not hardcoded
11. **LHW**: Comprehensive workspace with patient assignment, visit logging, follow-up queue, stats, monthly reports, admin oversight
12. **Next**: Security hardening → pregnancy content → appointments → admin analytics → testing
13. **Don't change**: Risk engine, referral lifecycle, care mission auto-creation, auth flow, access filters, Prisma relationships
14. **Biggest risks**: No pagination, no scheduled jobs, no offline capability, single MySQL instance, single AI provider (OpenRouter), session-only auth (no refresh tokens)
