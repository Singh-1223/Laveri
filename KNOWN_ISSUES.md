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

## Issue 2 — Recurring "Stale edit rejected" conflicts after flaky connections `[x]` (fixed in connector, needs device verification)

**Area:** `src/data/powersync/platform.native.ts` (`SupabaseConnector.uploadData`)

### Symptom
After a day or two, Sync status fills with "Stale edit rejected: expected server version N" (observed 105, mostly `milk_entries` / `milk_allocations`, all within about 4 seconds). Logout/login clears them temporarily.

### Corrected root cause
`uploadData` applies a batch operation by operation and only calls `transaction.complete()` at the end. If the connection drops mid-batch, or the server applies an op but the response is lost, the SDK retries the whole batch. Ops that already succeeded now assert their old base version, the server is one ahead, and each is logged as a conflict even though the edit is already on the server. Flaky Wi-Fi plus large milk save batches produce exactly the observed burst.

### Ruled out (do not retry)
An earlier theory blamed the client's `version = version + 1` as a second writer. That is wrong: the client increment keeps several offline edits to one row in lockstep with the server trigger (A: 5 to 6, B: 6 to 7). Removing it makes every second edit stale. The client increment and the `trackPrevious` config are intentionally unchanged.

### Fix
- Stale PATCH: re-read the server row. If it already holds every patched value (ignoring server-owned `updated_at` / `updated_by`, and timestamp-format and boolean/int differences), treat it as already applied and record no conflict. Any differing value still becomes a conflict, as before.
- `saveConflict` de-duplicates identical unresolved conflicts so retries do not stack duplicates.
- A patch that only touches server-owned columns (unchanged auto-save) carries no data, so it counts as applied.
- `reconcileStaleConflicts` (runs after connect) marks existing logged stale conflicts `resolved_at` when the server row captured at conflict time (`remote_payload`) already held the edit, falling back to the current server row. It never deletes or clears anything; non-matching conflicts stay visible.
- Logic lives in `src/data/powersync/stale-patch.ts`; `tests/upload-replay.test.mjs` simulates the server trigger and a mid-batch drop, reproducing the bug (before) and confirming zero false conflicts (after).

### Not done / follow-ups
- No local data is cleared or migrated, and there is no schema change.
- Optional: skip no-op rows in the milk auto-save to cut redundant PATCH traffic.
- Verify on a device: simulate a mid-upload disconnect and confirm no new stale conflicts appear.
