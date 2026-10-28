# Change Tracking — Dairy App Fixes

Tracking file for the four fixes/features from the issue PDF. Each task is worked **one at a time**, then marked complete.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Codebase context (discovered)

- Expo + PowerSync (local SQLite) + Supabase sync. Repository pattern under `src/data/repositories/*` with `*.native.ts` implementations.
- Key schema (`src/data/db/schema.ts`):
  - `treatments` (has single `animal_id`) and a **join table `treatment_animals`** `(treatment_id, animal_id)`.
  - `animals` has a single current `milk_entry_category` (`milking` | `not_milking` | `milk_calf`) and `is_milking` flag. **No category-by-date history exists.**
  - `milk_entries`, `milk_calf_allocations`, `milk_allocations` keyed by `milk_date` + `session`.
- Milk screen header (`src/app/(app)/(tabs)/milk.tsx`) holds the Daily Diary (📖) button inside `AppScreen`'s `action` prop. Other screens use `AppScreen` pull-to-refresh via `onRefresh`.
- Reports screen (`src/app/(app)/(tabs)/reports.tsx`) renders inline `react-native-svg` line charts; has 10d/1m/3m + custom range pattern and "exclude today" helpers (`lastCompletedFarmDay`).

---

## Task 1 — Multiple animal selection in Treatment expenses `[x]`

**Problem:** A treatment with multiple animals selected only shows/saves for one animal.
Root cause: `createTreatment` already writes all links into `treatment_animals`, but reads and updates ignore the join table.

- [x] 1.1 History read: `listRecentOperations` treatment branch now lists all linked animal tags via `treatment_animals` (`group_concat`), falling back to `treatments.animal_id` for legacy rows.
- [x] 1.2 Profile read: `loadAnimalProfile` treatment query now matches `animal_id OR id IN treatment_animals`, so the entry appears in every linked animal's history.
- [x] 1.3 Edit: `startEdit` loads linked animals via new `listTreatmentAnimalIds`; `updateTreatment` now takes `animalIds[]` and re-syncs the full `treatment_animals` set (soft-delete removed, revive/insert selected).
- [x] 1.4 Delete/void: `voidOperation` for treatments also soft-deletes `treatment_animals` links.
- [x] 1.5 UI, treatment fields, and cost calculations unchanged. `typecheck` + `lint` pass.

## Task 2 — Milk Calf / category changes affect future dates only `[x]`

**Problem:** Changing an animal to Not Milking/Milking (or Milk Calf) immediately changes its visibility and consumption records on **past** dates in Milk Entry. It should only apply to **future** dates.
Root cause: milk queries filter on the animal's current `milk_entry_category`/`is_milking`, with no date-awareness.

**Decision:** No new schema/migration. Preserve past dates by keying visibility off *saved records*, matching the Milk Entry query's existing `OR entry.id IS NOT NULL` pattern. A date's history is defined by whether a record was saved on that date — which is exactly "use actual saved records" and never mutates past data.

- [x] 2.1 Milk Entry query already preserved past dates via `OR entry.id IS NOT NULL` (future dates correctly drop a now-not-milking animal). Confirmed, no change needed there.
- [x] 2.2 Milk Calf query was the real bug — it filtered purely on current `milk_entry_category = 'milk_calf'`, so switching category erased the Milk Calf row on past dates too. Fixed to `((active AND milk_entry_category='milk_calf') OR allocation.id IS NOT NULL)` in `loadMilkSession` (`milk.native.ts`), so past dates with saved consumption always remain visible; future dates drop once no longer Milk Calf.
- [x] 2.3 Animal profile shows `Milk Consumed = <total>` (one line) whenever the animal has ≥1 Milk Calf allocation. Added `milkCalfConsumedMl` + `milkCalfEntryCount` to `loadAnimalProfile`/`AnimalProfile`; rendered in the Profile card. Auto-refreshes via the screen's `useFocusEffect(load)` after any add/edit/delete.
- [x] 2.4 Past records untouched (visibility now driven by saved rows). `typecheck` + `lint` pass.

## Task 3 — Refresh button in the top bar `[x]`

**Problem:** No tap-to-refresh; only pull-to-refresh exists.

- [x] 3.1 Milk screen: 🔄 (↻) button added beside the Daily Diary (📖) button, calling the existing `startRefresh` (= `refreshPowerSync()` sync + page reload, identical to pull-to-refresh). App-wide: `AppScreen` header now also renders a ↻ button whenever a screen provides `onRefresh` (Herd, Expenses, Reports, dashboard).
- [x] 3.2 Shows an `ActivityIndicator` while refreshing; debounced — milk via `refreshInFlight` ref, `AppScreen` via `refreshing` guard + disabled button, so repeated taps don't start duplicate refreshes.
- [x] 3.3 Pull-to-refresh untouched everywhere. `typecheck` + `lint` pass.

## Task 4 — Reports: "Farm Average Milk Production" `[x]`

**Problem/feature:** New report with daily-average line graph.
Formula per day: `(morning + evening total milk) ÷ (# milking animals that date)`, excluding Not Milking / Milk Calf from the count. Exclude today. Ranges: 10d / 1m / 3m / custom.

- [x] 4.1 `getFarmAverageMilk` (reports.native.ts) groups `milk_entries` by `milk_date`: `sum(volume_ml)` = total produced, `count(DISTINCT animal_id)` = milking animals that date, `averageMl = round(total / count)`. Milk Calf consumption lives in `milk_calf_allocations` so it's excluded from both numerator and count; Not Milking animals have no entry so they're excluded from the count — this is the date-accurate category per Task 2's saved-records approach. Web stub added to reports.ts; `FarmAverageMilkPoint` type added.
- [x] 4.2 Reports screen: new "Farm Average Milk Production" SectionCard with 10d/1m/3m + custom range controls, a green line graph (`FarmAverageChart`), and a per-date table (date · milking count · avg/animal). Reuses existing range + chart patterns.
- [x] 4.3 Recalculates on focus/refresh and when range changes; today always excluded (upper bound clamped to yesterday via `graphLastDay`). Existing reports unchanged. `typecheck` + `lint` + `test` (9/9) pass.

---

## Notes / decisions log

- Tasks 2 and 4 both need an animal's category **as of a given date**. Decision: avoid a new category-history table/migration. Instead treat *saved records* as the source of truth for a date's state — the Milk Entry query already did this (`OR entry.id IS NOT NULL`); applied the same idea to Milk Calf, and to Task 4's milking-animal count (an animal "was milking on date D" iff it has a `milk_entries` row on D). This matches the PDF's "use actual saved milk-entry records" and never mutates past data.
- A format-on-save step repeatedly reverted single-line import edits during the session; re-applied after each verify until clean. Final `typecheck` + `lint` + `test` all green.

## Final verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test` — 9/9 pass
- Note: the project builds/runs only in an Android/iOS dev build (PowerSync native); repository logic verified via typecheck/lint/tests. Runtime behaviour on-device not exercised in this environment.

---

## Task 5 — Update Previous Milk Rate for VERKA `[x]`

**Problem:** Every buyer except VERKA has the "Apply this rate to recorded milk" (date-range) control in Master data → Buyers. VERKA is excluded by a UI gate.

**Investigation:** The underlying `updateBuyerRateRange` (master-data.native.ts) is already buyer-agnostic — it updates `milk_allocations` by `buyer_id` + date range, changing only `rate_paise_per_litre` and `amount_paise`, never quantity/FAT/SNF. VERKA's allocations live in the same `milk_allocations` table (its billing-cycle rate is applied there by `saveVerkaCycle` with the identical SQL). So VERKA needs no repository change — only the UI gate `name !== 'verka'` blocks it, and the range update does NOT touch `verka_billing_cycles`, so new-entry/fixed-rate behaviour stays intact (req #5).

- [x] 5.1 Removed the `!== 'verka'` exclusion in master-data.tsx — VERKA now shows the From/To calendars (`DateField`), rate input, and "Apply rate to selected dates" button like every other buyer. Help text tailored for VERKA to clarify only the rate changes and new entries keep the billing-cycle rate.
- [x] 5.2 No repository change needed: `applyBuyerRateRange` → `updateBuyerRateRange` writes only `milk_allocations.rate_paise_per_litre` + `amount_paise` within the range; `verka_billing_cycles` and new-entry behaviour untouched; quantity/FAT/SNF untouched. `typecheck` + `lint` pass.
