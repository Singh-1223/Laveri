# Phase 0 — Cloud Setup and Validation

The repository contains the runnable mobile architecture spike, but it deliberately contains no cloud credentials. Complete these steps against development projects before using real farm data.

## 1. What the spike is designed to prove

- Google identity maps to one stable Supabase user.
- First-use onboarding atomically creates an owner, farm, and membership.
- RLS limits cloud CRUD operations to farm members.
- PowerSync downloads only farms selected from the trusted JWT user ID.
- A record can be written to local SQLite with no connection and uploaded later.
- The same record downloads to a second device signed in as the same user.
- Stale version edits are rejected and recorded in the local conflict list.
- Signing out disconnects sync and removes downloaded data from the device.

This is an architecture screen, not a dairy feature screen. It will be replaced after the Phase 0 gate passes.

## 2. Supabase development project

1. Create a development Supabase project.
2. Apply every committed migration under `supabase/migrations` in filename order using the Supabase CLI.
3. Confirm the identity tables and all dairy tables from `TECHNICAL_PLAN.md` exist.
4. Confirm RLS is enabled on every table exposed through the Data API.
5. Do not place the service-role key or database password in the Expo environment.

### Google provider

1. In Google Auth Platform, create a **Web application** OAuth client.
2. Add the Supabase callback shown by the Supabase Google provider page. It has this form:

   `https://<project-ref>.supabase.co/auth/v1/callback`

3. Enable Google in **Supabase → Authentication → Providers** and add the Google client ID and client secret there.
4. In **Supabase → Authentication → URL Configuration**, add this mobile redirect URL:

   `laveri://auth/callback`

The Google client secret belongs only in Google/Supabase configuration. It never belongs in `.env` or application code.

## 3. PowerSync development instance

1. Create a development PowerSync project/instance.
2. Follow PowerSync's Supabase source-database setup to create a dedicated read-only replication role. Generate a strong password outside this repository.
3. Grant that role `USAGE` on `public` and `SELECT` only on the synchronized tables.
4. Create or update the `powersync` publication to include every table selected in `powersync/sync-streams.yaml`. Keep local-only tables such as `sync_conflicts` out of the publication.
   When applying `202608290001_correction_audit.sql` to an existing project that uses an explicit table list, add `public.correction_events` to the publication before deploying the updated Sync Streams.
5. Connect the development Supabase database to the PowerSync instance.
6. Enable Supabase Auth/JWKS for client authentication.
7. Copy `powersync/sync-streams.yaml` into the Sync Streams editor, validate it, and deploy it.

Sync Streams authorize downloads. Supabase RLS authorizes CRUD operations reaching PostgreSQL. Both layers are required.

## 4. Expo environment

Copy `.env.example` to `.env` and fill in only public values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_POWERSYNC_URL=https://<instance>.powersync.journeyapps.com
```

Restart Metro after changing these values.

## 5. Development build

PowerSync uses a native SQLite adapter and therefore does not run inside Expo Go.

Before the first Android build, keep at least 12 GB of disk space free. The native toolchain may need Android Build Tools 35 and 36, NDK 27.1, CMake 3.22, Gradle transforms, and an emulator image at the same time.

`npm install` automatically applies `patches/@op-engineering+op-sqlite+17.2.0.patch`. The patch makes OP-SQLite 17.2 inherit Expo's configured NDK instead of downloading an unnecessary second NDK. Remove it when the PowerSync-supported OP-SQLite release contains the same upstream setting.

```bash
npm run android
```

After the first native build, Metro can be started for the installed development client with:

```bash
npm run start:dev-client
```

## 6. Local automated validation

The local database stack does not need cloud credentials:

```bash
npm run supabase:start
npm run db:reset
npm run db:test
npx supabase db lint --local --level warning
npm run supabase:stop
```

Validation recorded on 2026-08-27 and 2026-08-28:

- the Phase 0 migration applies to a clean local PostgreSQL database;
- all 32 pgTAP security and behavior tests pass;
- the complete MVP schema adds a second 32-test pgTAP suite, pending execution when Docker Desktop is available;
- the database linter reports no schema warnings;
- TypeScript and ESLint pass;
- Expo Doctor reports 21/21 checks passed;
- Android autolinking, code generation, resources, Kotlin/Java compilation, and native OP-SQLite compilation pass;
- complete x86_64 and arm64-v8a debug APK builds pass;
- the arm64-v8a APK installs successfully on the Android emulator.

The pgTAP suite is in `supabase/tests/phase0_security.test.sql`. It verifies RLS, ownership onboarding, cross-user isolation, audit-field protection, optimistic version increments, anonymous denial, and the prohibition on hard deletes.

## 7. Cloud and device test sequence

These are milestone tests for the project owner to run, not a requirement to repeat during ordinary feature development. Record results in `TESTING.md` when the development cloud services are configured.

### A. Identity and ownership

1. Sign in with Google.
2. Tap **Initialize owner farm**.
3. Confirm one `farms` row and one owner `farm_members` row in Supabase.
4. Tap onboarding again or repeat on another device; no second farm should be created for the same owner.

### B. Offline durability

1. Wait until **First sync** is complete.
2. Enable airplane mode.
3. Tap **Save to local SQLite**.
4. Force-close and reopen the app while still offline.
5. Confirm the local record is still visible and the pending upload count is non-zero.
6. Restore connectivity and confirm the pending count reaches zero and the row appears in Supabase.

### C. Second device

1. Install the development build on another device.
2. Sign in with the same Google account.
3. Confirm the same farm and test record download.
4. Sign in with an unrelated test account and verify the first farm does not download.

### D. Conflict rejection

1. Put both devices offline after they have the same record version.
2. Tap **Edit newest record** on both devices.
3. Reconnect device A and wait for its upload.
4. Reconnect device B.
5. Confirm device B displays a stale-edit conflict instead of silently overwriting device A.

### E. Sign-out isolation

1. Tap **Sign out and remove local data**.
2. Confirm farm records are no longer available on the device.
3. Sign in again and confirm they return only after authenticated synchronization.

## 8. Deferred Phase 0 acceptance

Cloud acceptance passes when tests A–E work on actual Android development builds and an unrelated authenticated user fails both the Supabase RLS tests and PowerSync download test. Feature implementation may continue before this user-run acceptance, but production use remains blocked until it passes.

Official references:

- <https://docs.expo.dev/versions/v57.0.0/>
- <https://supabase.com/docs/guides/auth/social-login/auth-google>
- <https://docs.powersync.com/integrations/supabase/guide>
- <https://docs.powersync.com/integrations/supabase/rls-and-sync-streams>
- <https://docs.powersync.com/client-sdks/reference/react-native-and-expo>
