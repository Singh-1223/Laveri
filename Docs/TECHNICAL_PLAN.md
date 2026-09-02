# Laveri — Technical Architecture and Delivery Plan

**Status:** Approved stack; implementation plan ready for review
**Prepared:** 2026-08-27
**Product references:** `REQUIREMENTS.md` and `Requriement_by_claude.md`
**Current application:** Expo 57, React Native 0.86, TypeScript, Expo Router
**Phase 0 implementation:** Local schema/security suite passes (32/32) and Android debug APK builds pass; development cloud setup and user-run device validation remain pending (`PHASE0_SETUP.md`, `TESTING.md`)
**MVP implementation:** Authenticated shell, complete cloud/local schema, master data, Mode 01/02 milk and allocation, farm operations, correction audit, dashboard aggregates, report drill-down, CSV export, and sync diagnostics are implemented; production backup/restore and user-run acceptance remain (`MVP_PROGRESS.md`)

## 1. Purpose and precedence

This document converts the product requirements into an implementation plan. It does not replace the dairy workflows, calculations, forms, or screen ideas in the two reference documents.

Where the references disagree with decisions made after they were written, this document takes precedence for technical architecture:

- Sign-in, cloud backup, and multi-device synchronization are required from the first production release, not Phase 2.
- The app remains local-first. Entry, history, dashboard totals, and core reports read from the local database and work offline.
- PowerSync replaces a custom Next.js/REST synchronization service.
- Supabase PostgreSQL replaces MongoDB or a separately hosted Prisma database.
- Supabase Auth replaces Clerk and local-PIN-only identity.
- Expo Router, already installed in the project, remains the navigation layer.
- A local PIN or biometrics may later provide a device lock, but it is not the user's cloud identity.

## 2. Confirmed product assumptions

- The first pilot has one owner and one farm.
- The same owner may use the app on two or three devices.
- Data belongs to a farm and is accessible only to authenticated members of that farm.
- Google sign-in is the primary authentication method.
- The first sign-in and a new device's first data download require internet access.
- After initial synchronization, core farm work must continue without connectivity.
- The design includes `farms` and `farm_members` now so a second family member can be added later without restructuring all data.
- The app is Android-first but should not intentionally block iOS support.

## 3. Confirmed stack

| Concern | Choice | Responsibility |
| --- | --- | --- |
| Mobile app | Expo 57 + React Native + TypeScript | UI, workflows, local calculations |
| Navigation | Expo Router | Routes, tabs, stacks, deep links |
| Cloud identity | Supabase Auth | Google sign-in, session, stable `auth.uid()` |
| Cloud database | Supabase PostgreSQL | Durable canonical database, constraints, RLS |
| Offline database and sync | PowerSync + SQLite | Local source of truth, downloads, upload queue |
| Binary files | Supabase Storage | Photos, invoices, prescriptions, exports |
| Validation | Shared TypeScript schemas and domain functions | Form and business-rule validation |
| Backend API | None initially | Add Edge Functions only for privileged workflows if needed |

PowerSync does not replace Supabase. Supabase remains the authoritative cloud platform; PowerSync keeps the approved subset of PostgreSQL available in a local SQLite database and queues local writes until the device reconnects.

## 4. System boundaries

```text
Expo screens and forms
        |
Domain rules and use cases
        |
Repositories / local transactions
        |
PowerSync-managed SQLite  <---->  PowerSync service  <---->  Supabase PostgreSQL
        ^                                                    + RLS
        |
Local SQL reports

Supabase Auth -------- session/JWT -------- app + PowerSync

Local file queue ------ online upload ------ Supabase Storage
```

Important boundaries:

- Screens do not call PostgreSQL directly for ordinary application data.
- Screens observe/query local SQLite through repository hooks.
- A form save succeeds after an atomic local transaction; it does not wait for the network.
- The PowerSync connector uploads queued row changes through Supabase using the current authenticated session.
- PostgreSQL constraints and RLS are the final server-side authority.
- Photos and documents do not pass through PowerSync. Only their metadata is synchronized as rows.
- Report totals are derived from source transactions and are not the only stored version of the data.

## 5. Authentication and onboarding

### 5.1 First owner

1. The owner signs in with Google while online.
2. Supabase returns a session and stable user ID.
3. An idempotent onboarding operation creates:
   - one `profile` for the user;
   - one `farm`;
   - one `farm_member` with role `owner`; and
   - default `farm_settings`.
4. The app connects PowerSync and waits for the minimum initial data set.
5. The owner completes farm settings and master data.

The onboarding operation must be atomic. It should be implemented as a carefully scoped database function or equivalent server transaction, not as several unrelated client inserts.

### 5.2 Additional devices

The owner signs in with the same Google account. Because the Supabase user ID is the same, RLS and PowerSync select the existing membership and download the same farm data.

A newly installed device cannot operate offline until it has authenticated and completed its first synchronization.

### 5.3 Future family members

Arbitrary Google users must not be allowed to create membership in an existing farm. A later invite flow will issue or approve a `farm_member` row with a role such as `operator`. The schema includes roles now, but the first UI only needs the owner role.

### 5.4 Recovery and device lock

- Google sign-in is the primary method for the pilot.
- A verified email/password identity may be linked to the same Supabase user as a recovery method if the family wants it.
- Do not create a second independent account for recovery; identity linking must preserve the same user ID.
- PIN/biometric lock is a later on-device convenience and privacy layer. It does not replace Supabase Auth.
- Keep a separate local database per authenticated user, or securely clear the previous user's local database before another account can use the device.

## 6. Data ownership and common columns

All farm-owned synchronized tables include:

| Column | PostgreSQL type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Client-generated stable primary key |
| `farm_id` | `uuid` | Ownership and synchronization boundary |
| `created_at` | `timestamptz` | Original creation time |
| `updated_at` | `timestamptz` | Latest accepted change time |
| `created_by` | `uuid` | Supabase user that created the row |
| `updated_by` | `uuid` | Supabase user that last changed the row |
| `deleted_at` | `timestamptz null` | Soft deletion/voiding |
| `version` | `bigint` | Optimistic concurrency check |

Rules:

- UUIDs are generated on the device so records can be created offline.
- Ordinary app actions do not hard-delete business records.
- A server trigger controls trusted audit timestamps and increments `version`.
- `farm_id` is immutable after creation.
- Foreign keys must not cross farm boundaries. Use composite checks or database triggers where a simple foreign key cannot enforce this.
- `auth.users` is not queried by the app as a profile table. Application profile data lives in `public.profiles`.

## 7. Proposed cloud and local schema

### 7.1 Identity and configuration

| Table | Important fields |
| --- | --- |
| `profiles` | `id` = auth user ID, name, email snapshot, avatar URL |
| `farms` | name, currency, timezone, locale, active |
| `farm_members` | farm ID, user ID, role, membership status |
| `farm_settings` | units, default milk mode, session names, reporting preferences |
| `milk_pricing_configs` | mode, effective dates, flat rate, CMFAT, CMSNF, optional buyer scope |

### 7.2 Master data and herd

| Table | Important fields |
| --- | --- |
| `animals` | tag/name, category, sex, status, breed, birth/acquisition dates, lactation metadata, notes |
| `buyers` | name, contact, default rate, active |
| `items` | type (`feed`, `medicine`, `product`), name, base unit, active |

### 7.3 Daily records

| Table | Important fields |
| --- | --- |
| `milk_entries` | animal, local milk date, session, volume, FAT/SNF, pricing snapshot, state |
| `milk_allocations` | milk date/session, destination type, optional buyer, volume, rate snapshot, amount |
| `feed_transactions` | date, optional animal/category, item, quantity, rate, amount, supplier, note |
| `treatments` | date/time, animal, optional medicine item, dose, doctor fee, medicine cost, total, note |
| `product_transactions` | date, optional animal/category, item, transaction category, quantity, rate, amount, supplier, note |
| `heat_events` | animal, observed time, signs/note, status, follow-up time |
| `attachments` | owning entity type/ID, bucket, object path, media type, size, upload state metadata |

### 7.4 Audit and operational records

| Table | Sync policy |
| --- | --- |
| `audit_entries` | Keep in PostgreSQL; sync only a limited recent window if the correction UI needs it |
| `sync_conflicts` | Local-only user-facing record of rejected stale writes |
| `attachment_upload_queue` | Local-only queue for files awaiting Storage upload |

Separate transaction tables are preferred to a generic JSON transaction table. They allow strong constraints, understandable reports, and clear forms.

## 8. Numeric, date, and money representation

PowerSync maps PostgreSQL `numeric`/`decimal` values to SQLite text. To keep offline queries and calculations predictable, business quantities should use scaled integers wherever practical:

| Value | Stored form | Example |
| --- | --- | --- |
| Money | `bigint` paise | ₹123.45 = `12345` |
| Milk | `bigint` millilitres | 12.50 L = `12500` |
| FAT/SNF | integer hundredths of a percent | 4.25% = `425` |
| General quantity | integer milli-units plus unit code | 2.500 kg = `2500`, `kg` |
| Business date | PostgreSQL `date` | `2026-08-27` in farm timezone |
| Event time | `timestamptz` | Heat/treatment/audit event |

Domain functions convert these values for display and formulas. Calculations use stored source values and explicit rounding rules. JavaScript numbers must not be used for unbounded database integers without a checked conversion boundary.

The exact scale for CMFAT, CMSNF, and calculated price snapshots will be fixed when the Mode 02 examples are validated. It must be an integer scale, documented and covered by tests.

## 9. Database constraints

At minimum, PostgreSQL migrations enforce:

- unique active animal tag/name per farm;
- unique milk entry per farm, animal, milk date, and session while not voided;
- one farm membership per user/farm pair;
- valid enum/check values for roles, animal category/status, session, destination, and transaction category;
- non-negative quantities, rates, fees, percentages, and totals;
- allocation destination consistency: buyer destinations require a buyer; household does not;
- all referenced master and transaction rows belong to the same farm;
- immutable IDs, farm ownership, creator, and creation time;
- version increment on every accepted update.

The app performs the same friendly validation before save, but client validation never replaces database constraints. An offline duplicate may be created on separate devices; the server constraint rejects the later upload and the app surfaces it as a sync issue instead of silently overwriting data.

## 10. Row Level Security

RLS is enabled on every table exposed through the Supabase Data API. RLS is authoritative for CRUD operations that reach PostgreSQL, but it does not automatically filter PowerSync's replication downloads. PowerSync Sync Streams are a separate, equally required download-authorization layer and must mirror the same ownership rules.

Policy model:

- A user can read farm rows only when an active `farm_members` row links `auth.uid()` to that `farm_id`.
- Owners can create and update farm configuration and master data.
- Operators, when introduced, can create daily records and edit only according to an explicit correction policy.
- Inserts require `created_by = auth.uid()` and a farm the user belongs to.
- Updates require membership and preserve immutable ownership columns.
- Client hard deletes are denied; voiding is an update to `deleted_at` with a reason where required.
- Storage access uses matching farm membership policies.

Use small SQL helper functions for membership checks only when necessary, and review any `SECURITY DEFINER` function carefully. The Supabase service-role key, database password, and privileged secrets must never be included in the app.

RLS tests must cover at least owner, unrelated user, unauthenticated user, inactive membership, and forged `farm_id` cases.

## 11. PowerSync design

### 11.1 Download scope

Use PowerSync Sync Streams so the authenticated user receives:

- their profile and farm membership;
- their farm and settings;
- active and historically referenced master data;
- farm transaction data needed for entry, history, dashboard, and reports.

The initial farm is small enough to sync its complete operational history. If the data grows materially, attachments and audit history are reduced first; core source transactions remain available offline.

Stream rules are filtered by the trusted JWT value `auth.user_id()` and farm membership. Never authorize a farm download from a client-supplied `farm_id`, because the client can change that parameter. The exact stream configuration will be validated during the architecture spike against the deployed PowerSync edition.

Security responsibilities are complementary:

- Sync Streams decide which rows can be downloaded to a device.
- PostgreSQL RLS decides which Supabase CRUD operations the authenticated user may perform.
- Both must be tested; passing one layer does not prove the other is secure.

### 11.2 Local source of truth

- UI lists and reports query local SQLite.
- Local tables use the PowerSync client schema and SQLite-compatible types.
- Every screen distinguishes `loading initial data` from a genuinely empty farm.
- A local write and its related child writes run in one database transaction.
- PowerSync's upload queue is the canonical row-sync status; do not add an independent `sync_status` column to every business table unless the SDK cannot provide the required UI state.

### 11.3 Upload connector

The connector processes queued operations through the authenticated Supabase client:

- create: insert using the client UUID, with idempotent duplicate handling;
- update: update the target row only when its server `version` equals the edit's base version;
- void: perform a soft-delete update, not a physical delete;
- permanent delete: restricted to exceptional administration workflows outside the ordinary app.

Uploads are retried when connectivity returns. Validation/RLS/conflict failures are classified separately from temporary network failures so permanent errors do not retry forever without explanation.

### 11.4 Sync timing

- Connect and synchronize while the authenticated app is in the foreground.
- Retry promptly on reconnect and when the user taps **Sync now**.
- Background synchronization is best effort only because Android and iOS schedule background tasks themselves.
- Do not promise a fixed background interval or depend on background execution for data safety.
- The header/status screen shows pending work, last successful sync, connection state, and actionable failures.

## 12. Conflict policy

Although one person owns the pilot, two devices can edit the same record. Timestamp-based last-write-wins is not sufficient because device clocks can drift and a legitimate change can disappear.

Use optimistic version checks:

1. A downloaded row contains `version`.
2. A local edit retains that base version.
3. The upload updates the cloud row only if the cloud version still matches.
4. The database increments the version on success.
5. If no row is updated, the write is stale and becomes a conflict.

Conflict behavior:

- Never silently overwrite the newer cloud record.
- Store enough local information to show the attempted value and current cloud value.
- Let the owner discard the local change or reapply it to the current version.
- Treat ordinary daily records as append-oriented; corrections are less common than creates.
- Make create operations idempotent with UUIDs.
- If two devices create the same logical milk entry with different UUIDs, the unique business constraint rejects the duplicate and the sync issue links to the existing entry.

For the first pilot, field-by-field automatic merging is unnecessary and riskier than an explicit small conflict screen.

## 13. Storage and attachments

Supabase Storage buckets are private. Suggested buckets:

- `animal-media`
- `farm-documents`
- `generated-exports`

Object paths follow:

`{farm_id}/{entity_type}/{entity_id}/{file_uuid}.{extension}`

The `attachments` row synchronizes through PowerSync; the binary file does not. When offline, the app copies the chosen file into app-controlled storage and adds a local upload job. On reconnect it uploads the file, then updates the attachment metadata. Interrupted uploads remain visible and retryable.

Storage RLS validates farm membership from the path and/or attachment metadata. Signed URLs are created only for authorized viewing. File type and size limits are set per bucket.

Attachments are not required for the first daily-operations slice, but the ownership and queue design must be preserved when they are introduced.

## 14. Offline behavior by scenario

| Scenario | Expected behavior |
| --- | --- |
| Existing device opens without internet | Cached session and local farm data open; core entry/reporting works |
| User saves milk/expense offline | Atomic local save; UI updates immediately; upload remains pending |
| App closes before upload | Local SQLite and PowerSync queue survive restart |
| Connectivity returns | Foreground/reconnect sync uploads and downloads automatically |
| New device is offline | Sign-in and initial data are unavailable; explain that first setup needs internet |
| Session refresh temporarily fails | Existing local data remains usable; privileged cloud actions wait |
| RLS/validation rejects a write | Preserve local attempted data and show an actionable sync issue |
| User signs out | Disconnect sync, prevent access to that user's database, offer/remove local data safely |

Core offline reports include daily dashboard totals, milk sales, finance summary, and animal productivity because they query local transactions. Cloud-only operations may include account recovery, invitations, large export delivery, and administrative backup.

## 15. Application structure

The target boundaries are:

```text
src/
  app/                 Expo Router routes and layouts
  features/            Feature UI and orchestration
    auth/
    dashboard/
    milk/
    herd/
    expenses/
    reports/
    settings/
    sync/
  domain/              Pure calculations, types, validation, use cases
  data/
    db/                PowerSync schema and local migrations
    repositories/      Local queries and atomic commands
    sync/              Connector, status, conflicts
    supabase/          Auth client and privileged online operations
    storage/           Local file queue and Storage client
  components/          Shared presentation and form controls
  config/              Environment and app configuration
  i18n/                Centralized user-facing strings
supabase/
  migrations/          PostgreSQL schema, constraints, triggers, RLS
  tests/               Database and RLS tests
```

Business formulas live in `domain`, not in screen components or SQL-only report code. Repositories hide the persistence mechanism from features. Environment-specific endpoints are validated once at startup.

## 16. Environment and secret handling

Use separate development and production Supabase/PowerSync environments before the family relies on real records.

Values allowed in the application bundle include the Supabase project URL, Supabase publishable/anon key, Google public client IDs, and PowerSync endpoint. They are identifiers, not privileged secrets, and all access still depends on Auth and RLS.

Never bundle:

- Supabase service-role key;
- PostgreSQL password or connection string;
- Google OAuth client secret;
- PowerSync administrative credentials.

Database changes are committed as migrations. Production changes are not made only through a dashboard without an equivalent migration in the repository.

The app will require an Expo development build because the recommended PowerSync SQLite adapter uses native modules and is not supported by Expo Go. Exact Expo 57-compatible packages must be verified against the versioned Expo documentation before installation.

## 17. Backup strategy

Synchronization is not a backup: a bad deletion can synchronize to every device.

The production checklist includes:

- scheduled PostgreSQL dumps stored outside the Supabase project;
- periodic restore tests into a non-production project;
- CSV export for user-readable reports and records;
- documented retention and recovery steps;
- monitoring the free-plan limits and inactivity behavior before production reliance.

Do not describe free-tier automatic database backups as guaranteed. If the production data becomes important to farm operations, moving to a paid plan or running a reliable external backup job is a deliberate release decision.

## 18. Testing strategy

### Domain tests

- Mode 01 and Mode 02 calculations and rounding;
- milk allocation and variance;
- expense/treatment totals;
- operating vs economic profit;
- missing milk entry vs true zero;
- farm timezone/date boundaries.

### Database tests

- constraints, soft deletion, audit fields, and version increments;
- RLS access for every role and hostile cross-farm inputs;
- onboarding transaction idempotency;
- pricing snapshots remain unchanged after configuration updates.

### Offline and sync tests

- airplane-mode create/edit/restart;
- reconnect and upload drain;
- two devices edit the same row;
- two devices create the same logical milk entry;
- expired session and refresh recovery;
- rejected validation/RLS write remains recoverable;
- sign-out/sign-in and local database isolation;
- interrupted attachment upload.

### Product reconciliation

Run an agreed sample month through both the workbook and the app. Dashboard, sales, finance, and productivity results must reconcile before pilot release.

## 19. Delivery phases and gates

### Phase 0 — Architecture spike

Deliver:

- development Supabase project and SQL migration skeleton;
- Google sign-in on an Android development build;
- owner onboarding with `farm_members`;
- PowerSync connection and one farm-owned test table;
- create offline, restart, reconnect, and observe the row on a second device;
- one RLS denial test and one version-conflict test.

Gate: the complete identity → local write → queued upload → PostgreSQL → second-device download loop works before building the dairy forms.

### Phase 1 — Foundation

Deliver:

- replace the Expo starter routes with the app shell;
- session/bootstrap states and protected routes;
- complete core schema, migrations, RLS, and PowerSync client schema;
- repository, validation, error, and sync-status foundations;
- farm settings, animals, buyers, and item master data.

Gate: the owner can configure the farm online or offline and the data converges correctly across two devices.

### Phase 2 — Daily milk, Mode 01

Deliver:

- morning/evening entry by active milking animal;
- session/day totals, atomic save, history, edit, and void;
- buyer/household allocation and variance;
- flat-rate snapshots;
- local daily dashboard.

Gate: a full week can be entered offline and reconciled after sync without lost or duplicate records.

### Phase 3 — Farm operations

Deliver:

- feed transactions;
- medicine/veterinary treatments;
- product/miscellaneous transactions;
- heat events;
- correction and audit views.

Gate: validation, totals, history, and correction behavior pass product tests for each workflow.

### Phase 4 — Pricing and reports

Deliver:

- Mode 02 quality pricing and immutable pricing snapshots;
- sales, finance, and animal productivity reports from local SQL;
- date/animal/buyer filters and drill-down;
- CSV export.

Gate: workbook and app results reconcile for the agreed test data.

### Phase 5 — Production hardening

Deliver:

- attachment queue if required for pilot;
- external backup and tested restore;
- accessibility, performance, diagnostics, and recovery review;
- two/three-device field test;
- signed Android release build and operating guide.

Gate: no unresolved data-loss, RLS, backup, or reconciliation defect remains.

## 20. Decisions still needed from the family

These do not block the Phase 0 architecture spike, but they block their related features:

1. Is milk pricing mode fixed, or selected by day, session, buyer, or delivery?
2. Are FAT/SNF captured per session, per animal, or per buyer delivery?
3. Are CMFAT/CMSNF farm-wide or buyer-specific, and when do rate changes take effect?
4. Does treatment total include doctor fee plus medicine cost?
5. Does feed represent purchases, animal consumption, or both as separate records?
6. What exactly are **Investment**, **Household consumption value**, and **Cash in hand** for this farm?
7. Which heat follow-up fields are needed in the pilot?
8. Which pilot languages are required?
9. Is email/password recovery wanted in addition to Google sign-in?
10. Should signing out erase the device's downloaded farm database automatically or only through an explicit **Remove local data** action?

Until confirmed, the affected rules remain configurable and no ambiguous financial calculation is silently assumed.

## 21. Immediate next step

Proceed with MVP implementation in vertical slices while keeping the Phase 0 cloud/device checks documented for user-run milestone testing. During development, use automated TypeScript, lint, domain, database, and build checks; do not block feature coding on repeated emulator interaction. The next implementation slice is the application shell, complete dairy schema, and master data, followed by daily milk Mode 01.

## 22. Implementation references

Use current official documentation during implementation, especially:

- Expo 57 documentation: <https://docs.expo.dev/versions/v57.0.0/>
- Supabase Auth with Google: <https://supabase.com/docs/guides/auth/social-login/auth-google>
- Supabase user-data and RLS guidance: <https://supabase.com/docs/guides/auth/managing-user-data>
- Supabase API security and RLS: <https://supabase.com/docs/guides/api/securing-your-api>
- Supabase Storage access control: <https://supabase.com/docs/guides/storage/security/access-control>
- PowerSync with Supabase: <https://docs.powersync.com/integrations/supabase/guide>
- PowerSync RLS and Sync Streams responsibilities: <https://docs.powersync.com/integrations/supabase/rls-and-sync-streams>
- PowerSync React Native/Expo SDK: <https://docs.powersync.com/client-sdks/reference/react-native-and-expo>
- PowerSync conflict-resolution guidance: <https://docs.powersync.com/handling-writes/custom-conflict-resolution>
