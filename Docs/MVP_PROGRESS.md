# Laveri MVP Progress

Last updated: 2026-08-29

## Completed in code

- Confirmed Expo + Supabase + PowerSync architecture and environment validation.
- Supabase owner onboarding, farm membership, RLS foundation, and optimistic versioning.
- Complete MVP PostgreSQL schema for settings, pricing, animals, buyers, items, milk, allocations, feed, treatments, products, and heat events.
- Matching PowerSync SQLite schema, secure farm-member Sync Streams, generic idempotent uploads, soft deletes, and stale-edit conflict capture.
- Protected Expo Router authentication shell with Google sign-in and local-data removal on sign-out.
- Home, Milk, Herd, Expenses, and Reports tab structure.
- Offline-first master-data creation/listing for animals, buyers, feed, medicines, and products.
- Searchable/filterable local Herd view.
- Daily Mode 01 morning/evening milk entry for every active milking animal.
- Atomic local save of production plus buyer/household allocations, rate and amount snapshots, totals, and allocation variance.
- Feed, treatment, product/investment, and heat-event forms with combined local history.
- Offline master-data editing and deactivate/reactivate controls for animals, buyers, and items.
- Versioned milk-session corrections plus reason-required soft voids for complete sessions.
- Reason-required soft voids for feed, treatment, product, and heat records, with voided rows retained in activity history and excluded from totals.
- Offline field-level editing for feed, treatment, product, and heat records with amount recalculation and optimistic version increments.
- Search and kind filters across active and voided farm-operation history, including void-reason matching.
- Immutable correction events with atomic before/after snapshots for master edits, deactivation/reactivation, operation edits/voids, and milk-session edits/voids.
- Searchable correction-history screen with action filters, user attribution, void reasons, field changes, and milk-session total comparisons.
- Farm-wide effective-dated flat or FAT/SNF quality pricing configuration, including immutable pricing snapshots on milk entries.
- Mode 02 milk entry with session-level FAT/SNF capture, integer-safe CMFAT/CMSNF calculation, and calculated buyer-allocation values.
- Local Home aggregates for production, allocation, turnover, operating cost, profit, and investment.
- Local date-range sales, finance, cost, and animal-productivity reports with animal/buyer source drill-down filters.
- Excel-compatible CSV report export through the device folder picker.
- Persistent synchronization status pill plus pending-upload, last-sync, error, and stale-conflict screen.
- Integer-safe milk, rate, allocation, expense, treatment, and finance calculations.
- Automated TypeScript, lint, and 9-test domain suite.
- Automated production Android JavaScript bundle export for the current route tree.
- User-run milestone testing and troubleshooting guide in `TESTING.md`.

## In progress

- Recoverable external backup/restore workflow and production hardening.

## Next vertical slices

1. Select and document the production backup/restore mechanism for the Supabase project.
2. Production diagnostics, accessibility, and release hardening.
3. Workbook reconciliation and pilot-device acceptance.

## Deferred user-run validation

- Development Supabase/PowerSync/Google configuration.
- Google OAuth return flow.
- Offline restart and reconnect upload.
- Same-account second-device convergence.
- Unrelated-account isolation and two-device conflict behavior.
- Workbook reconciliation and pilot-device acceptance.

These checks are deferred to milestone testing, not removed. Production use stays blocked until the release-blocking checks in `TESTING.md` pass.
