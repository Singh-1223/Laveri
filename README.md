# Laveri Dairy

Laveri is an Android-first, offline-first dairy operations app for a single family farm. It records herd master data, morning/evening milk, buyer and household allocation, feed, treatments, products/investments, heat events, and local reports.

## Stack

- Expo 57, React Native 0.86, TypeScript, and Expo Router
- Supabase Google Auth, PostgreSQL, RLS, and Storage
- PowerSync with SQLite for offline reads, atomic local writes, queued uploads, and multi-device synchronization

Expo Go cannot run this project because PowerSync uses native modules. Use an Android/iOS development build.

## Complete setup guide

Complete this once for a new development Supabase project and PowerSync instance. Never place a database URI, database password, Google Client Secret, Supabase service-role key, or PowerSync replication password in `.env` or this repository.

### 1. Install and configure the local project

Install Node.js 22.13 or newer and Android Studio/SDK. Docker Desktop is optional, but required for local Supabase database tests.

```bash
cd /Users/lovepreet.singh/Desktop/code/projects/extensions/laveri
npm install
cp .env.example .env
```

Set only public values in `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_POWERSYNC_URL=https://YOUR_INSTANCE.powersync.journeyapps.com
```

The Supabase URL is the **Project URL**, not a PostgreSQL connection string. `PROJECT_REF` is the part before `.supabase.co`.

### 2. Create and migrate Supabase

Create a Supabase project, then link this repository and apply all committed migrations:

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase db push
npx supabase migration list
```

### 3. Configure Google sign-in

Laveri uses browser-based OAuth, so create a **Web application** OAuth client in Google Auth Platform.

1. Add this Authorized redirect URI in Google:

   ```text
   https://PROJECT_REF.supabase.co/auth/v1/callback
   ```

2. In **Supabase → Authentication → Providers → Google**, enable Google and add the Client ID and Client Secret.
3. In **Supabase → Authentication → URL Configuration**, add:

   ```text
   laveri://auth/callback
   ```

4. Keep **Skip nonce checks** off and **Allow users without an email** off.

Google returns to Supabase through the HTTPS callback. Supabase then opens the Android app through `laveri://auth/callback`.

### 4. Prepare Supabase for PowerSync

Generate a long password in a password manager. In **Supabase → SQL Editor**, replace the placeholder and run this script once:

```sql
create role powersync_role
with replication bypassrls login password 'YOUR_LONG_RANDOM_PASSWORD';

grant usage on schema public to powersync_role;

grant select on table
  public.profiles, public.farms, public.farm_members, public.farm_settings,
  public.milk_pricing_configs, public.animals, public.buyers, public.items,
  public.milk_entries, public.milk_allocations, public.feed_transactions,
  public.treatments, public.product_transactions, public.heat_events,
  public.correction_events, public.spike_records
to powersync_role;

create publication powersync for table
  public.profiles, public.farms, public.farm_members, public.farm_settings,
  public.milk_pricing_configs, public.animals, public.buyers, public.items,
  public.milk_entries, public.milk_allocations, public.feed_transactions,
  public.treatments, public.product_transactions, public.heat_events,
  public.correction_events, public.spike_records;
```

`powersync_role` is a dedicated read-only replication account, not a Laveri app user. Do not re-run the script unchanged after it succeeds: the role and publication will already exist.

### 5. Configure PowerSync Cloud

1. Create or open a PowerSync Cloud instance and copy its instance URL into `EXPO_PUBLIC_POWERSYNC_URL`.
2. In **PowerSync → Database Connections**, choose **Connect to Source Database** and select PostgreSQL.
3. In **Supabase → Connect**, copy the **Direct connection** PostgreSQL URI. Paste it into PowerSync, then use `powersync_role`, its generated password, and SSL `verify-full`.
4. Test and save the connection. Initialisation can take a minute or two.
5. In **PowerSync → Client Auth**, enable **Use Supabase Auth**. For a modern Supabase project, leave the legacy JWT-secret field blank, then save and deploy.
6. In **PowerSync → Sync Streams**, paste [powersync/sync-streams.yaml](powersync/sync-streams.yaml), validate it, and deploy it.

### 6. Install and start the Android development build

PowerSync uses native modules, so Expo Go cannot run Laveri.

```bash
npx expo run:android
```

After the development build is installed, start Metro for JavaScript/TypeScript-only changes:

```bash
npm run start:dev-client
```

Restart Metro after changing `.env`. A release build must be rebuilt to include changed public environment values.

### 7. First smoke test

1. Open Laveri and sign in with Google.
2. Create the farm, add one animal and buyer, configure flat milk pricing, and save a morning session.
3. Confirm Home and Reports totals.
4. Enable airplane mode, create another record, force-close/reopen, and confirm it remains.
5. Restore connectivity and confirm **Sync status** reaches zero pending uploads.

Share [Docs/CLIENT_TESTING_GUIDE.md](Docs/CLIENT_TESTING_GUIDE.md) with the client for a plain-language walkthrough of every app screen and the complete acceptance checklist. Use [Docs/RELEASE_AND_PILOT_TESTING.md](Docs/RELEASE_AND_PILOT_TESTING.md) to create and share an EAS-signed APK and run the family pilot checklist. Use [Docs/TESTING.md](Docs/TESTING.md) for the full technical Mode 02, second-device, correction, CSV-export, and conflict checks.

## Guide for later updates

Use the smallest applicable checklist. Never modify an already-applied migration to alter a deployed database; create a new migration instead.

### JavaScript or TypeScript UI changes only

Examples: screens, styles, display text, calculations, or repository queries that do not change the database or native dependencies.

```bash
npm run verify
npm run start:dev-client
```

Reload the installed development app. No database deployment or native rebuild is needed.

To share this change with the family, still create a new standalone APK after the focused check:

```bash
npx eas-cli@latest build --platform android --profile preview
```

The development client is only for development. The EAS preview APK is the app that family members install and use without Metro or a developer computer.

### New or changed database fields, tables, constraints, or RLS policies

1. Create a new migration:

   ```bash
   npx supabase migration new descriptive_change_name
   ```

2. Edit the generated SQL. Prefer additive and backward-compatible changes: add a nullable/defaulted field, backfill if required, release the app update, then remove obsolete fields only in a later migration.
3. Update the matching TypeScript types, repository SQL, validation, and pgTAP tests.
4. Run local database checks when Docker Desktop is available:

   ```bash
   npm run supabase:start
   npm run db:reset
   npm run db:test
   npx supabase db lint --local --level warning
   npm run supabase:stop
   ```

5. Review and deploy the migration:

   ```bash
   npx supabase db push
   ```

6. Run `npm run verify`, start Metro, and test the changed workflow.
7. After the migration and PowerSync configuration are confirmed, create a new EAS preview APK before sharing the app update.

### Adding a new offline-synchronized table

Alongside the database checklist, update every one of these:

1. Add the table to [src/data/db/schema.ts](src/data/db/schema.ts).
2. Add it to `UPLOADABLE_TABLES` in [src/data/powersync/platform.native.ts](src/data/powersync/platform.native.ts) if the app writes to it.
3. Add its farm-member-filtered query to [powersync/sync-streams.yaml](powersync/sync-streams.yaml).
4. Grant access and add it to the existing publication in Supabase SQL Editor:

   ```sql
   grant select on table public.new_table to powersync_role;
   alter publication powersync add table public.new_table;
   ```

5. Deploy the migration using `npx supabase db push`.
6. Validate and deploy the changed Sync Streams configuration in PowerSync Dashboard.
7. Restart the development app. If its local schema cannot migrate cleanly during development, sign out and sign in again to clear the local cache and download it anew. Do this only after confirming cloud data is synchronized.

### Renaming or removing a database field

Use staged migrations:

1. Add the replacement field and make the app support old and new data.
2. Backfill existing rows in a migration.
3. Release and validate the app using the new field.
4. Once active app versions no longer use the old field, remove it in a later migration.

Also remove obsolete local schema columns, repository references, streams, reports, and CSV usage in that later release.

### New npm package or Expo/app configuration change

Examples: a native Expo module, `app.json`, Android permissions/package, or an Expo plugin.

```bash
npm install
npm run verify
npx expo run:android
```

`npx expo run:android` rebuilds and reinstalls the native development client. It is not needed for JavaScript-only changes.

For a family/tester update after either type of change, create a fresh standalone APK:

```bash
npx eas-cli@latest build --platform android --profile preview
```

### Google, Supabase, or PowerSync dashboard-only changes

1. Make the dashboard change.
2. Restart Metro if `.env` changed.
3. Sign out and sign in again if authentication/token settings changed.
4. Check **Sync status** for connection or upload errors.
5. Run the focused relevant section of [Docs/TESTING.md](Docs/TESTING.md).

### Before every handoff or test milestone

```bash
npm run verify
git diff --check
```

For schema/RLS changes, also run local database checks. For native dependency or app-configuration changes, also rebuild Android.

### Before sharing any update with the family

1. Confirm pending uploads are zero on your own test device before changing or reinstalling it.
2. Run `npm run verify` and test the changed workflow.
3. If the change includes a database migration, run `npx supabase db push` first. If it adds/changes synchronized data, deploy the updated PowerSync Sync Streams configuration too.
4. If `.env` values changed, update the same `preview` environment variables in Expo Dashboard before building.
5. Create the APK:

   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

6. Download the completed APK link from EAS and install it over the previous Laveri APK on one device first. Verify sign-in, old data, and Sync status before sharing it.

Use the same EAS project and `preview` profile every time. EAS automatically increases Android's build number and uses the same cloud keystore, allowing Android to treat the next APK as an update rather than a different app.

## Automated checks

```bash
npm run verify
```

With Docker Desktop running, also validate migrations and RLS:

```bash
npm run supabase:start
npm run db:reset
npm run db:test
npx supabase db lint --local --level warning
npm run supabase:stop
```

## Project documents

- [Docs/REQUIREMENTS.md](Docs/REQUIREMENTS.md) — normalized product requirements from the workbook
- [Docs/Requriement_by_claude.md](Docs/Requriement_by_claude.md) — additional reference specification
- [Docs/TECHNICAL_PLAN.md](Docs/TECHNICAL_PLAN.md) — approved architecture and delivery decisions
- [Docs/MVP_PROGRESS.md](Docs/MVP_PROGRESS.md) — current implementation status and next slices
- [Docs/TESTING.md](Docs/TESTING.md) — owner-run milestone testing and troubleshooting
- [Docs/PHASE0_SETUP.md](Docs/PHASE0_SETUP.md) — development cloud and first-device setup
- [Docs/providers.md](Docs/providers.md) — account/provider notes; keep it free of secrets

Manual emulator, OAuth, offline, and two-device testing is intentionally grouped into milestone passes described in [Docs/TESTING.md](Docs/TESTING.md); ordinary development uses automated checks and Android bundle/build validation.
