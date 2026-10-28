# Known Issues / Deferred Fixes

Backlog of known problems we've decided NOT to fix right now, with enough context to pick up later.

Status legend: `[ ]` open · `[~]` in progress · `[x]` done

---

## Issue 1 — Milking animal with no saved entry disappears from past Milk Entry dates `[ ]`

**Severity:** Medium (usability; no data loss)
**Area:** Milk Entry visibility · `src/data/repositories/milk.native.ts` (`loadMilkSession`), `src/app/(app)/master-data.tsx` (category change)

### Symptom
When a milking cow is changed to **Not Milking** (or **Milk Calf**), it disappears from **previous** Milk Entry dates where no value was ever saved — so you can no longer go back and enter a missed day's milk for that period.

### Confirmed behaviour (not data loss)
- Saved milk records are NOT deleted. `updateAnimal` only changes the `animals` row (`is_milking`, `milk_entry_category`); it never touches `milk_entries`.
- The Milk Entry query shows an animal on a date only if:
  ```sql
  (animal.status = 'active' AND animal.is_milking = 1)   -- currently milking
  OR entry.id IS NOT NULL                                 -- a SAVED entry exists for that date
  ```
  So a past date with a *saved* value still shows the cow. A past date with **no saved value** loses the cow once it's no longer currently milking, because nothing anchors the empty row.
- Same limitation applies to the Milk Calf section (`OR allocation.id IS NOT NULL` only preserves dates that already have a saved calf allocation).

### Root cause
There is **no date-aware record of an animal's category**. The animal carries a single *current* `milk_entry_category` / `is_milking` flag. Visibility on past dates is inferred only from saved records, so category history before the first saved record on a date is unknown.

### Proper fix (deferred — needs schema + migration)
Add a **milking-category history** so we can resolve "what category was this animal on date D":

1. New synced table, e.g. `animal_milk_category_changes` (`id`, `farm_id`, `animal_id`, `category`, `effective_from` date, audit cols). Supabase migration + `set_audit_columns_and_version` trigger + RLS policy + PowerSync schema entry + add to `UPLOADABLE_TABLES`.
2. Write a history row on `createAnimal` and on every category change (`updateAnimal`, and the deactivate/reactivate path in `setMasterRecordActive`).
3. Backfill one initial row per existing animal (effective from acquisition/birth date, fallback to a far-past sentinel) so old dates resolve.
4. Rewrite Milk Entry + Milk Calf visibility in `loadMilkSession` to join "category in effect on `milkDate`" instead of the current flag — show a milking animal on any date whose in-effect category was `milking`, even with no saved value.
5. Reuse the same "category as of date" for Task 4 (Farm Average Milk Production) milking-animal count, replacing the current saved-entry proxy with an exact count.

### Decisions to confirm before implementing
- **Goal:** past dates should list every animal that was *milking at that time*, even with no saved value (so a missed day can still be entered). (Tentatively yes.)
- **Effective date of a change:** default to **today** when the user flips category (so the change applies to future dates only; past dates keep the prior category). Alternative: prompt for an effective date. (Default: today.)
- **History start for pre-existing animals:** effective_from = acquisition date → else birth date → else far-past sentinel. (Default.)

### Watch-outs
- This touches sync. See Issue 2 (version double-increment) — the new table will also get the version trigger; make sure the backfill doesn't create a write flood.
- Decide behaviour for dates *before* an animal's first history row (treat as earliest known category, or not visible).

---

## Issue 2 — Sync `version` double-increment causes recurring "Stale edit rejected" conflicts `[ ]`

**Severity:** High (edits can land in a permanent local conflict queue; worked around today only by logout/login full resync)
**Area:** Optimistic concurrency · `src/data/powersync/platform.native.ts` (`SupabaseConnector.uploadData`), every repository `UPDATE`, Supabase trigger `set_audit_columns_and_version`, `src/data/db/schema.ts` (`trackPrevious`)

### Symptom
After 1–2 days of use, the Sync status screen fills with "Stale edit rejected: expected server version N" conflicts (observed 105, mostly `milk_entries` / `milk_allocations`). Logging out and back in clears them temporarily, then they return.

### Root cause (confirmed)
`version` has **two independent writers**:
- **Server:** trigger `set_audit_columns_and_version` runs `new.version := old.version + 1` on every update (all tables).
- **Client:** every repository `UPDATE` also does `version = version + 1`.

The connector's optimistic check asserts `.eq('version', previousValues.version)` (version stripped from the patch via `IMMUTABLE_PATCH_COLUMNS`). The scheme only works while the client's local increments stay in perfect lockstep with the server's trigger increments. Concurrent/auto-save edits, bulk range updates, a rejected op, or a download re-applying a row break the lockstep; once local and server `version` diverge by ≥1, every later PATCH's `previousValues.version` is wrong → stale → parked in `sync_conflicts` (local-only) → poisoned until a full resync.

- Milk rows dominate because they're edited most (1.25s auto-save on the milk screen; VERKA/buyer rate-range updates PATCH many allocation rows at once).
- Logout/login runs `disconnectAndClear({ clearLocal: true })` → re-downloads rows at the server's current `version` → realigns → conflict queue cleared.

### Proper fix (deferred)
Make the **server the sole authority** on `version`:
- **A.** Remove `version = version + 1` from every repository UPDATE (sites across `milk.native.ts`, `operations.native.ts`, `master-data.native.ts`, `animal-profile.native.ts`, `reports.native.ts`, `pricing.native.ts`, `platform.native.ts` spike, `verka-billing.native.ts`, `corrections.native.ts`, `household-consumption.native.ts`, `buyer-account.native.ts`). The trigger already supplies the new version.
- **B.** Change `schema.ts` `trackPrevious` from `{ columns: ['version'], onlyWhenChanged: true }` to `trackPrevious: true` (or `onlyWhenChanged: false`) so `previousValues.version` is still captured on PATCH even though the client no longer mutates `version`. The connector keeps asserting `.eq('version', previousValues.version)`, now against the true server value.
- **C.** (Optional hardening) On a genuinely stale PATCH (real multi-device conflict), make the connector re-read the server row and rebase/retry instead of permanently parking it in `sync_conflicts`.

### Migration caveat
Existing installs already carry drifted local DBs. After shipping A+B, each device needs **one** resync (logout/login or a programmatic `disconnectAndClear`) to realign once; consider triggering that automatically on the update that ships the fix.
