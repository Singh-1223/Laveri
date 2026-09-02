# Laveri Testing and Troubleshooting Guide

This is the single testing runbook for the MVP. Development should stay fast: automated checks run continuously while coding, while emulator/physical-device and two-device checks are grouped into milestone passes for the project owner.

## Current validation status

Recorded on 2026-08-29:

- `npm run verify` passes: TypeScript, ESLint, and 9 domain calculation/validation tests;
- the current authenticated routes, master data, milk/allocation, farm operations, Home aggregates, and local reports export as a production Android JavaScript bundle;
- the earlier Phase 0 PostgreSQL/RLS suite passed 32/32 tests;
- the new complete MVP schema has an additional 32-test pgTAP suite ready in `supabase/tests/mvp_schema.test.sql`;
- the immutable correction-audit migration has a separate 6-test pgTAP security suite ready in `supabase/tests/correction_audit.test.sql`;
- Mode 02 pricing, report source drill-down, CSV export, and the production sync-status screen pass TypeScript and ESLint checks;
- that new database suite still needs to be executed when Docker Desktop is running;
- x86_64 and arm64-v8a Android debug APK builds passed before the latest JavaScript-only app-shell changes; and
- manual emulator, OAuth, offline, and two-device checks are intentionally deferred to the project owner’s milestone testing.

## 1. Testing responsibilities

### Automated checks run during development

Run after every meaningful code slice:

```bash
npm run verify
npm test
git diff --check
```

When a database migration or RLS policy changes, also run (Docker Desktop must be running):

```bash
npm run supabase:start
npm run db:reset
npm run db:test
npx supabase db lint --local --level warning
npm run supabase:stop
```

When native dependencies or Expo configuration change, produce an Android debug APK:

```bash
npm run android
```

Automated checks cover types, lint, business formulas, validation, PostgreSQL constraints, RLS, and whether the native app compiles. They do not prove that Google OAuth, cloud synchronization, or the complete phone workflow works in the configured external services.

### User-run milestone checks

Run manual tests only at these points:

1. **Cloud foundation ready:** Google sign-in, onboarding, first sync, and same-account second-device download.
2. **Milk slice ready:** one complete day of morning/evening milk, allocation, offline restart, and later synchronization.
3. **Operations slice ready:** feed, treatment, product, and heat-event create/edit/void workflows.
4. **Reporting slice ready:** reconcile the agreed workbook sample against dashboard, sales, finance, and productivity reports.
5. **Pilot candidate ready:** full offline/two-device/backup/restore pass on the phones the family will use.

Do not enter real farm records until the pilot-candidate pass succeeds.

## 2. One-time development setup

Requirements:

- Node.js 22.13 or newer for Expo 57;
- Android Studio/SDK for Android development builds;
- Docker Desktop for the local Supabase database suite;
- a development Supabase project;
- a development PowerSync instance; and
- Google OAuth configured through Supabase.

Install dependencies and create the public environment file:

```bash
npm install
cp .env.example .env
```

Fill only the three public values documented in `PHASE0_SETUP.md`. Never add a service-role key, database password, Google client secret, or PowerSync administrative secret to `.env`.

## 3. Starting the Android development app

PowerSync requires native modules, so Expo Go cannot run this app.

For the first build, or after native dependencies/configuration change:

```bash
npm run android
```

For later JavaScript/TypeScript-only changes, start Metro for the installed development client:

```bash
npm run start:dev-client
```

If using a USB-connected physical device, run:

```bash
adb reverse tcp:8081 tcp:8081
```

Then set the React Native development bundle location to `localhost:8081` if the client does not select it automatically.

## 4. Milestone result template

Copy this checklist under the applicable milestone and record failures precisely:

```text
Date:
App commit:
Device and Android version:
Network state:
Test data/date range:

[ ] Passed
[ ] Failed

Expected:
Observed:
Screenshot/video:
Relevant error text:
Reproduces after app restart: yes/no
Reproduces on another device: yes/no/not tested
```

Precise test data is important for calculation problems. For milk/report failures, include the date, session, animal, litres, buyer allocation, rate, and expected total.

## 5. Cloud foundation milestone

Follow the detailed A–E sequence in `PHASE0_SETUP.md`. At minimum verify:

- Google sign-in completes and returns to the app;
- onboarding creates exactly one farm for the owner;
- the same Google account on another device downloads the same farm;
- an unrelated account cannot read the farm;
- an offline record survives force-close and uploads after reconnect;
- conflicting edits do not silently overwrite each other; and
- sign-out removes access to downloaded farm data on that device.

## 6. Offline test pattern for every entry form

Use this same sequence for milk, feed, treatments, products, and heat events:

1. Complete initial sign-in and synchronization while online.
2. Enable airplane mode.
3. Create an entry and confirm it appears immediately in history/totals.
4. Force-close and reopen the app while still offline.
5. Confirm the entry remains and can be opened.
6. Restore connectivity.
7. Confirm the pending upload count returns to zero.
8. Confirm the entry appears on the second device.
9. Edit it on the second device and confirm the first device receives the change.

## 7. Milk and report reconciliation data

Keep one small, fixed dataset for every build. Recommended minimum:

- two active milking cows;
- morning and evening production for seven days;
- two buyers plus household consumption;
- at least one day with unallocated milk;
- Mode 01 flat-rate sales;
- Mode 02 FAT/SNF pricing after that feature is enabled;
- feed, doctor/medicine, operating product, and investment transactions; and
- one missing animal/session entry that is distinct from a recorded zero.

Calculate expected totals independently or in the source workbook. Compare production, allocation variance, revenue, operating cost, investment, operating profit, and per-animal productivity.

## 8. Correction and void milestone

Run these checks offline first, then reconnect and repeat the observations on the second device.

### Master data

1. Edit an animal tag, breed, category, and milking status; confirm the Herd and Milk screens reflect the change.
2. Deactivate an animal; confirm it is retained in Master data and historical reports but is no longer offered for new milk or operation entries.
3. Reactivate the animal and explicitly restore its milking status if required.
4. Repeat deactivate/reactivate for a buyer and each item type; historical rows must retain their original names and totals.

### Milk session

1. Save a morning session, then change litres or allocations and save again; confirm dashboard and reports use the corrected values once.
2. Open **Correct saved session**, attempt an empty reason, and confirm the void action stays disabled.
3. Void the session with a specific reason; confirm its production, allocation, and revenue disappear from active totals.
4. Enter replacement values for the same date/session and confirm only the replacement contributes to totals.
5. On a second device, confirm the replacement arrives and the voided rows do not reappear in active entry fields.

### Farm operations

1. Create one feed, treatment, product, and heat record.
2. Edit the date, linked animal/item, quantities, rates, costs, categories, and notes that apply to each record; confirm calculated amounts and reports update once.
3. Void each record with a different reason; confirm the reason remains visible in Recent activity.
4. Confirm voided costs disappear from Home and Reports while the activity row remains marked as voided.
5. Reconnect and confirm the pending upload queue drains and the second device sees the same active totals and void history.

### Conflict behavior

1. Let both devices download the same active record version.
2. Keep both offline, correct or void the record on device A, and make a competing edit on device B.
3. Reconnect A and wait for upload, then reconnect B.
4. Confirm the stale second change is reported as a conflict rather than silently overwriting the first.

### Immutable audit history

1. Open **Home → Open correction history** after every edit, deactivate/reactivate, or void action.
2. Confirm the action, timestamp, user, reason, and changed values match the operation just performed.
3. For milk sessions, confirm the before/after produced and allocated totals match the session values.
4. Reconnect and confirm the correction event appears on the second device.
5. Confirm no UI offers an edit or delete action for a correction event.

## 9. Mode 02 pricing milestone

1. Open **Home → Configure milk pricing**, select **FAT + SNF**, and save an effective date that includes the test day.
2. Use CMFAT `600.00` and CMSNF `200.00`.
3. Open the Milk tab for that date. Enter FAT `4.25` and SNF `8.50`; confirm the calculated rate is ₹42.50/L.
4. Save production and a buyer allocation. Confirm the buyer amount equals allocated litres × ₹42.50 using two-decimal money display.
5. Change the pricing configuration to different coefficients with a later effective date. Reopen the older milk session and confirm it still shows its original coefficients and ₹42.50 snapshot.
6. Switch back to flat mode, save a new effective-dated flat rate, and confirm only new unsaved sessions use it.
7. Repeat steps 3–6 offline, force-close/reopen, reconnect, and confirm the same values arrive on the second device.

## 10. Report drill-down and CSV milestone

1. Open Reports and choose a date range containing milk, buyer allocations, and expenses.
2. Confirm summary values reconcile with the source workbook.
3. Filter **Milk source entries** by animal and **Buyer sales** by buyer; confirm every shown source row belongs to the selected filter.
4. Tap **Choose folder and export CSV**, select a writable device folder, and confirm a `laveri-report-...csv` file is created.
5. Open the CSV in Excel or Google Sheets. Confirm the summary, animal productivity, milk-entry, and buyer-sale rows match the on-screen date range and preserve accented/non-English text.

## 11. Sync status milestone

1. Save a record in airplane mode and confirm the header pill becomes amber with at least one pending upload.
2. Open the pill and confirm connection, pending count, first-download state, and last-sync time are understandable.
3. Restore connectivity, tap **Sync now**, and wait for the pending count to reach zero and the pill to turn green.
4. During the two-device conflict test, confirm the stale edit appears under **Unresolved conflicts** and the pill turns red.

## 12. Common problems

### “Unable to load script”

- Confirm Metro is running with `npm run start:dev-client`.
- Confirm port 8081 is not occupied by an unrelated process.
- For a USB device, run `adb reverse tcp:8081 tcp:8081`.
- In the React Native dev menu, set bundle location to `localhost:8081`, then reload.

### App shows cloud configuration required

- Confirm `.env` exists and contains all three `EXPO_PUBLIC_*` values.
- Restart Metro after changing `.env`.
- Do not quote or add spaces around values unless the value itself requires them.

### Google sign-in does not return to the app

- Confirm `laveri://auth/callback` is allowed in Supabase Auth URL configuration.
- Confirm the app scheme is still `laveri` in `app.json`.
- Confirm Google's Supabase callback URL matches the selected development Supabase project.
- Check that Google provider credentials are configured in Supabase, not in the mobile app.

### Local database tests cannot start

- Start Docker Desktop and wait until its engine is ready.
- Run `npm run supabase:stop`, then `npm run supabase:start`.
- If a previous Supabase stack is stale, inspect it before removing anything; do not delete Docker volumes containing needed data.

### Native Android build runs out of disk

- Keep at least 12 GB free before a clean build; more is safer when installing SDK/NDK components.
- Clear disposable package-manager/build caches rather than deleting source or database data.
- The generated debug APK is normally under `android/app/build/outputs/apk/debug/`.

### A record stays pending

- Confirm the device is online and the Supabase session is valid.
- Open Sync Status and capture its exact error.
- Check Supabase RLS/constraint errors and PowerSync upload logs.
- Do not recreate the entry until checking whether its UUID already exists in PostgreSQL; retries are designed to be idempotent.

### Data appears for the wrong user or after sign-out

Stop testing and do not use real data. Record both user IDs and the exact steps. This is a release-blocking isolation defect.

## 13. Release-blocking failures

The MVP must not be used for real farm operations while any of these remain unresolved:

- lost entry after a successful local save;
- cross-farm or cross-user data exposure;
- silent overwrite during a two-device conflict;
- totals that do not reconcile with source transactions;
- inability to restore a tested backup;
- duplicate logical milk entries after synchronization; or
- a migration that cannot be applied safely to an existing pilot database.
