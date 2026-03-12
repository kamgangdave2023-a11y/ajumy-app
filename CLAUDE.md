# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AJUMY** is a React Native (Expo) mobile app for managing *Association des Jeunes Unis de Manjo à Yaoundé* — a Cameroonian mutual association. The app is in French and handles member management, finances, attendance, tontines, solidarity funds, and more. All monetary values are in **FCFA**.

## Commands

```bash
npx expo start          # Start Expo dev server (scan QR with Expo Go)
npx expo start --android
npx expo start --ios
npx expo start --web
```

There are no tests or linting scripts configured.

## Architecture

### Authentication & Routing

`App.js` manages global auth state via Supabase. It conditionally renders `LoginScreen` (unauthenticated) or `DashboardScreen` (authenticated).

### Module Navigation

Navigation is **not** React Navigation stack-based. `DashboardScreen` holds an `activeModule` state; each module screen renders inline as a full-screen replacement when selected. Every module screen receives an `onBack` prop to return to the dashboard.

```
App.js
  └─ DashboardScreen.js  (activeModule state drives which screen shows)
       ├─ AdherentsScreen, PresenceScreen, CaisseScreen, ...
       └─ (16 modules total, see MODULES array in DashboardScreen.js)
```

### Key Libraries & Services

- **Supabase** (`src/lib/supabase.js`): backend, auth, and all database operations. Session persisted via AsyncStorage.
- **`useRole` hook** (`src/lib/useRole.js`): fetches the current user's role from the `adherents` table and exposes `peut(permission)`, `aRole(...)`, `isAdmin`, `isBureau`, `canEdit`, etc.
- **`caisse.js`** (`src/lib/caisse.js`): every financial transaction from any module must call the appropriate helper here to record a movement in the `mouvement_caisse` table. Module-specific helpers are grouped by source (e.g. `caisseVentes`, `caisseRoulement`).
- **`fcfa.js`** (`src/lib/fcfa.js`): use `formatFCFA(montant)` to display amounts and `arrondiCoupure(montant)` for rounding to valid FCFA denominations.

### Role & Permission System

Roles (defined in `useRole.js`): `SUPER_ADMIN`, `PRESIDENT`, `VICE_PRESIDENT`, `SECRETAIRE`, `TRESORIER`, `CENSEUR`, `COMMISSAIRE`, `ADHERENT`.

Permission keys: `superAdmin`, `sanctions`, `ventesApprobation`, `adherents`, `caisse`, `rapports`, `bureau`.

```js
const { peut, isAdmin, isBureau } = useRole();
if (peut('caisse')) { /* SUPER_ADMIN or TRESORIER */ }
```

User lookup: always attempts match by `email` first, then falls back to `user_id`.

### Shared Components (`src/components/`)

- `PageLayout` — responsive scroll wrapper (max-width 900px on desktop/web)
- `AppHeader` — standard screen header with back button
- `ActionButton` — primary CTA button
- `AjumyDateTimePicker` — wraps `@react-native-community/datetimepicker`
- `AvatarAdherent`, `StatCard`

### Supabase Tables (key ones)

| Table | Purpose |
|---|---|
| `adherents` | Member profiles, roles, statuses |
| `cahier_presence` | Sunday meeting attendance |
| `session_caisse` | Daily cash session summaries |
| `mouvement_caisse` | All cash flow entries (auto-recorded by `caisse.js`) |
| `dettes` | Member debts |
| `sanctions` | Member penalties |
| `roulement` | Rotating fund / tontine entries |
| `vente_banque` | Monthly bank sales |
| `fonds_roulement` | Rotating fund balance |
| `evenement` | Association events |
| `conversations` | Chat messages |
| `session_dimanche` | Sunday presence gate (QR/PIN/GPS) |
| `pointage_presence` | GPS+QR attendance check-ins |

### Presence Security System

Documented in `AJUMY_Systeme_Presence.md`. On Sundays when a session is open, members must scan a QR code and be within 100m GPS of headquarters before accessing the dashboard. Implementation files: `GpsGateScreen.js`, `usePresenceGate.js`, `usePresenceGps.js`, `GpsPointageComponent.jsx`.

## Conventions

- All UI text is in **French**.
- Styles are always defined with `StyleSheet.create()` at the bottom of each screen file — no separate style files.
- The primary brand color is `#1F3864` (dark blue); accent is `#C55A11` (orange).
- Dates stored as ISO strings (`YYYY-MM-DD`). When displaying, append `T12:00:00` to avoid timezone offset issues: `new Date(date + 'T12:00:00')`.
- Member statuses: `actif`, `en_observation`, `inactif`. Blacklisted members have `liste_noire: true`.
- Debt statuses: `en_cours`, `partiellement_rembourse`, `rembourse`.
