# Dairy Digital — App Specification
Expo (React Native) · Offline-first · Single-user

## 1. Tech Stack

| Layer | Choice |
|---|---|
| App framework | Expo (React Native), TypeScript |
| Navigation | React Navigation (Bottom Tabs + nested Native Stacks) |
| Local/offline storage | WatermelonDB or expo-sqlite (SQLite-backed, offline-first, sync-friendly) |
| Sync | Custom REST sync endpoint against Next.js/Prisma backend, client-UUID based, background sync via `expo-task-manager` / `expo-background-fetch` |
| Server | Next.js API routes + PostgreSQL + Prisma (as previously scoped) |
| Charts | `react-native-svg` + `victory-native` (or `react-native-gifted-charts`) |
| Auth | Local PIN/passcode (via `expo-local-authentication` + PIN fallback) — no server auth needed given single user |
| State | React Query (server sync state) + local DB as source of truth for entry screens |

---

## 2. Navigation Architecture

```
RootStack
 ├─ PinLockScreen                 (shown on launch / app resume)
 └─ MainTabs (Bottom Tab Navigator)
     ├─ Tab: Home
     │   └─ DashboardScreen
     │
     ├─ Tab: Milk
     │   └─ MilkStack
     │       ├─ MilkEntryScreen        (default)
     │       ├─ MilkHistoryScreen
     │       ├─ MilkQualityScreen
     │       └─ MilkSaleScreen
     │
     ├─ Tab: Animals
     │   └─ AnimalsStack
     │       ├─ AnimalListScreen       (default)
     │       ├─ AnimalDetailScreen
     │       └─ AnimalFormScreen       (add / edit)
     │
     ├─ Tab: Logs
     │   └─ LogsStack
     │       ├─ LogsHomeScreen         (default — 3 category cards)
     │       ├─ FeedLogScreen
     │       ├─ FeedFormScreen
     │       ├─ MedicineLogScreen
     │       ├─ MedicineFormScreen
     │       ├─ PurchaseLogScreen
     │       └─ PurchaseFormScreen
     │
     ├─ Tab: Reports
     │   └─ ReportsStack
     │       ├─ ReportsHomeScreen      (default)
     │       ├─ MilkProductivityScreen
     │       └─ FinanceSummaryScreen
     │
     └─ Tab: Settings
         └─ SettingsStack
             ├─ SettingsScreen         (default)
             ├─ MasterDataScreen       (feed types, medicines, buyers, rate constants)
             └─ SyncStatusScreen
```

**Total screens: 22** (1 lock + 21 in-app)

**Tab bar icons:** Home, Droplet (Milk), Cow (Animals), List (Logs), BarChart (Reports), Settings (gear).

**Cross-cutting navigation rules:**
- Every list screen (Milk History, Feed Log, Medicine Log, Purchase Log, Animal List) has a floating **"+" action button** → pushes the matching Form screen.
- Form screens (`*FormScreen`) are shared for both **Add** and **Edit** — mode passed via route param (`{ mode: 'add' | 'edit', id? }`).
- All Form screens on save: local DB write (instant) → pop back to list → queue background sync.
- A persistent **sync status pill** (small dot: green = synced, amber = pending, red = failed) shows in the header on every screen — tapping it opens `SyncStatusScreen`.

---

## 3. Screen-by-Screen Layout

### 3.1 PinLockScreen
- **Purpose:** gate app access (family device, single user)
- **Layout:** centered numeric keypad, 4–6 digit dots indicator, app logo top, biometric icon (Face/Touch ID) if enabled
- **Nav:** on success → `DashboardScreen`. No back button (root).

### 3.2 DashboardScreen (Home tab)
- **Purpose:** at-a-glance daily/monthly status
- **Layout (top to bottom):**
  - Header: today's date, sync status pill
  - **Today's Milk card**: total liters (AM + PM), quick "+ Add Milk Entry" button
  - **This Month card**: Turnover / Cost / Profit / In-Hand — 2×2 stat grid
  - **Top Producers** mini-list: top 3 cows by monthly milk, tap → `AnimalDetailScreen`
  - **Quick actions row**: Feed, Medicine, Sale, Purchase (icons → respective Form screens)
- **Nav:** each card/button routes into the relevant tab's stack.

### 3.3 MilkEntryScreen (Milk tab, default)
- **Purpose:** fast daily AM/PM entry per animal — the highest-frequency screen, must work fully offline
- **Layout:**
  - Date selector (defaults today, swipe/tap to change)
  - Session toggle: Morning / Evening
  - Scrollable list of active animals, each row: name + numeric input (liters) with steppers
  - Running total footer, sticky
  - "Save" button (large, bottom) — saves all rows in one local transaction
- **Nav:** Save → toast confirmation, stays on screen (repeat daily use); header icon → `MilkHistoryScreen`.

### 3.4 MilkHistoryScreen
- **Purpose:** browse/edit past entries
- **Layout:** calendar strip or date list, grouped by day, each day expandable to show AM/PM totals per animal; tap a day → edit mode (reopens MilkEntryScreen prefilled)
- **Nav:** from Milk tab header icon; row tap → `MilkEntryScreen` (edit mode).

### 3.5 MilkQualityScreen
- **Purpose:** enter FAT%/SNF% readings, view computed Rate/L
- **Layout:** date, FAT% input, SNF% input, computed rate shown live using stored CMFAT/CMSNF constants (editable in `MasterDataScreen`), history table below
- **Nav:** accessible via Milk tab sub-nav (segmented control at top of Milk stack: Entry / History / Quality / Sales) or a menu icon.

### 3.6 MilkSaleScreen
- **Purpose:** allocate the day's total milk across Sale01 / Sale02 / Home, compute revenue
- **Layout:** date, total milk (read-only, pulled from entries), 3 input rows (Sale01 qty, Sale02 qty, Home qty) with live "remaining to allocate" indicator, rate per channel, auto-computed revenue total
- **Nav:** part of Milk stack segmented control.

### 3.7 AnimalListScreen (Animals tab, default)
- **Purpose:** browse all animals
- **Layout:** filter chips top (All / Cows / Heifers / Calfs / Sold), searchable list, each row: name, category badge, lactation number, last milk yield; floating "+" → `AnimalFormScreen`
- **Nav:** row tap → `AnimalDetailScreen`.

### 3.8 AnimalDetailScreen
- **Purpose:** single-animal profile (covers the detailed cases like named individual animals)
- **Layout:** header (name, photo placeholder, category, status), key facts card (birth date, lactation no.), tabs/sections below: Milk trend (mini chart), Feed history, Medicine history — each "See all" linking into filtered Log screens
- **Nav:** edit icon → `AnimalFormScreen` (edit mode); back → `AnimalListScreen`.

### 3.9 AnimalFormScreen
- **Purpose:** add/edit an animal
- **Layout:** name/tag, category picker (Cow/Heifer/Calf/Sale), birth date picker, lactation number, status toggle (Active/Sold/Dead), notes field
- **Nav:** save → pop to `AnimalListScreen` or `AnimalDetailScreen` depending on entry point.

### 3.10 LogsHomeScreen (Logs tab, default)
- **Purpose:** hub for the three non-milk logs
- **Layout:** 3 large cards — Feed, Medicine, Other Purchases — each showing this month's total cost and a "+" quick-add
- **Nav:** card tap → respective `*LogScreen`.

### 3.11 FeedLogScreen
- **Purpose:** browse feed entries
- **Layout:** category filter (Cows/Heifers/Calfs), date-grouped list, each row: feed type, quantity, cost; floating "+" → `FeedFormScreen`
- **Nav:** row tap → `FeedFormScreen` (edit mode).

### 3.12 FeedFormScreen
- **Purpose:** add/edit feed entry
- **Layout:** category picker, date, feed type picker (from master list, "+ new" inline), quantity, rate (autofills from master, editable), computed total (read-only)
- **Nav:** save → pop to `FeedLogScreen`.

### 3.13 MedicineLogScreen
- **Purpose:** browse medicine/health entries
- **Layout:** same pattern as Feed Log — filter by category/animal, date-grouped list; floating "+"
- **Nav:** row tap → `MedicineFormScreen` (edit mode).

### 3.14 MedicineFormScreen
- **Purpose:** add/edit medicine entry
- **Layout:** animal picker, date, medicine picker (master list), dose, doctor's fee, comment field, computed total
- **Nav:** save → pop to `MedicineLogScreen`.

### 3.15 PurchaseLogScreen
- **Purpose:** browse other product purchases
- **Layout:** date-grouped list: product name, quantity, cost; floating "+"
- **Nav:** row tap → `PurchaseFormScreen` (edit mode).

### 3.16 PurchaseFormScreen
- **Purpose:** add/edit a purchase
- **Layout:** category, date, product name, quantity, rate, computed total
- **Nav:** save → pop to `PurchaseLogScreen`.

### 3.17 ReportsHomeScreen (Reports tab, default)
- **Purpose:** entry point to reports (server-computed, needs connectivity)
- **Layout:** 2 large tiles — "Milk Productivity" and "Finance Summary" — each with a mini sparkline preview; offline banner if no connection ("Reports need a connection to refresh")
- **Nav:** tile tap → respective report screen.

### 3.18 MilkProductivityScreen
- **Purpose:** per-cow milk trend over time
- **Layout:** date range selector (week/month/custom), multi-line or stacked bar chart per animal, ranked table below (total liters per animal for the period)
- **Nav:** back → `ReportsHomeScreen`; row tap → `AnimalDetailScreen`.

### 3.19 FinanceSummaryScreen
- **Purpose:** monthly P&L view
- **Layout:** month picker, stat cards (Turnover / Cost / Profit / Investment / Consumption / In-Hand), cost breakdown bar chart (Feed vs Medicine vs Purchases), revenue breakdown (Sale01/Sale02/Home)
- **Nav:** back → `ReportsHomeScreen`.

### 3.20 SettingsScreen (Settings tab, default)
- **Purpose:** app-level settings
- **Layout:** list items — PIN/biometric toggle, Language (English/Punjabi), Master Data, Sync Status, Backup/Export, About
- **Nav:** each item → respective screen.

### 3.21 MasterDataScreen
- **Purpose:** manage lookup lists used across forms
- **Layout:** segmented control (Feed Types / Medicines / Buyers / Rate Constants), simple add/edit/delete list per segment; Rate Constants segment has CMFAT/CMSNF numeric fields
- **Nav:** back → `SettingsScreen`.

### 3.22 SyncStatusScreen
- **Purpose:** visibility into offline queue
- **Layout:** summary (X pending, Y synced today, last sync time), list of pending records with type/date, manual "Sync now" button, per-item retry on failure
- **Nav:** back → wherever it was opened from (accessible from the header pill on any screen).

---

## 4. Offline-First Data Flow (applies to Milk Entry, Feed, Medicine, Purchase forms)

1. User submits a form → written immediately to local SQLite with a **client-generated UUID** and `sync_status: 'pending'`
2. UI updates instantly from local DB — no network wait
3. Background task (`expo-background-fetch`) periodically attempts to push `pending` records to the server sync endpoint in batches
4. Server upserts by client UUID (idempotent), returns confirmation
5. On success, local record flips to `sync_status: 'synced'`; on failure, stays `pending` / flips to `failed` after N retries, surfaced in `SyncStatusScreen`
6. Reports/Dashboard stat cards pull from server once synced — screens show a "last updated" timestamp and an offline banner when stale

---

## 5. Suggested Build Order

1. Navigation shell (tabs + stacks) with placeholder screens
2. Local DB schema (SQLite/WatermelonDB) mirroring the Prisma models
3. `MilkEntryScreen` + local save (no sync yet) — highest-frequency screen first
4. Sync layer (client UUID, background push, `SyncStatusScreen`)
5. Feed / Medicine / Purchase forms + logs (reuse the same offline pattern)
6. `AnimalListScreen` / `AnimalDetailScreen` / `AnimalFormScreen`
7. `MilkQualityScreen` + `MilkSaleScreen` (rate calc + allocation logic)
8. `DashboardScreen` (pulls from local + server)
9. Reports screens (server-side aggregation)
10. `PinLockScreen`, Settings, Master Data
