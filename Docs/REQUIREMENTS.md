# Laveri Dairy Management App — Product Requirements Document

**Status:** Draft for validation
**Target:** Expo / React Native mobile app (Android-first, with iOS and web compatibility)
**Primary source:** `Dairy Digital.xlsx`, especially the `APP` worksheet
**Prepared:** 2026-08-26

## 1. Product summary

Laveri is a dairy-farm operations app for recording daily milk production and allocation, tracking cow-related feed and medical activity, recording dairy costs and purchases, and reporting turnover, costs, profit, milk sales, and cow productivity.

The workbook is treated as a functional mockup, not as a literal screen layout. The mobile app should preserve its workflows and calculations while replacing spreadsheet-style grids with fast, touch-friendly forms and reports.

## 2. Product goals

1. Let a farm worker complete the day's milk entry quickly for every milking animal.
2. Make milk allocation traceable across buyers/customers and household consumption.
3. Keep feed, medicine, veterinary, and other product costs tied to a date and, where relevant, an animal group or individual animal.
4. Give the farm owner a clear daily and period-level view of production, turnover, costs, profit, and cash position.
5. Preserve enough history to compare milk productivity by animal and identify operational trends.

## 3. Users and assumptions

### Primary users

- **Farm owner/admin:** configures animals, buyers, rates, products, and quality-pricing constants; reviews and corrects records; sees all reports.
- **Farm worker/operator:** enters milk, feed, medicine, heat, and product records; sees operational history needed for the current day.

The workbook does not define users or permissions. For the MVP, a single-farm, single-owner setup can be used, but the data model should retain `farmId`, `createdBy`, and audit timestamps so multi-user support can be added without migration pain.

### Operating assumptions

- The first release is Android-first and should remain usable without continuous internet access.
- Default units are litres for milk, kilograms or configured packaging units for feed/products, and INR for money.
- Dates use the farm's local timezone; entries must not shift dates because of UTC conversion.
- `Sale01`, `Sale02`, `Cow01`, and `Cow02` in the workbook are examples, not hard-coded names.

## 4. Scope and priority

### MVP — required

- Farm setup and reusable master data
- Animal registry with cows, heifers, and calves
- Daily milk entry in two supported pricing modes
- Milk allocation to one or more buyers and household consumption
- Feed purchase/expense entry
- Medicine/veterinary treatment entry
- Product or miscellaneous purchase/expense entry
- Heat-event recording
- Daily dashboard and editable transaction history
- Sales, finance, and milk-productivity reports
- Offline local persistence, validation, and export/backup

### Phase 2 — recommended

- Account sign-in, multiple staff members, and role permissions
- Cloud backup and multi-device synchronization
- Notifications for heat follow-up, treatment, pregnancy checks, and low stock
- Inventory balances for feed, medicine, and products
- Breeding, insemination, pregnancy, calving, lactation, and dry-period workflows
- Attachments such as animal photos, invoices, and prescriptions
- Advanced charts and buyer payment/receivable tracking

### Out of scope for the first build

- IoT milking-machine integration
- Full accounting or tax filing
- Marketplace, e-commerce, or payment collection
- Veterinary diagnosis or medical recommendations

## 5. Information architecture

The recommended primary navigation is:

1. **Home** — today's status, incomplete tasks, and summary cards
2. **Milk** — milk entry and allocation
3. **Herd** — animal list, profile, productivity, and events
4. **Expenses** — feed, medicine, veterinary, product, and other costs
5. **Reports** — sales, finance, and milk productivity

Settings and master data can be reached from the Home header or profile menu.

The workbook's `Milk`, `Feed`, `Medicine`, `Heat`, and `Product` labels should become clear mobile actions or tabs. Repeated forms for cows, heifers, and calves should share one implementation with an animal-category filter.

## 6. Functional requirements

### FR-01 — Initial farm setup

The app shall let the owner configure:

- farm name, preferred currency, timezone, and default units;
- milk entry mode and default rate settings;
- morning/evening milking sessions;
- milk buyers/customers;
- feed items, medicines, products, and their units;
- quality-pricing constants used by Mode 02.

The app shall ship with no business names or rates hard-coded from the workbook.

### FR-02 — Animal registry

The user shall be able to add, edit, deactivate, and search animals.

Required animal fields:

- unique tag/name;
- category: cow, heifer, or calf;
- sex;
- active/inactive status;
- optional breed, date of birth, acquisition date, notes, and photo.

Milk entry shall show only active, milk-producing animals. Deactivated or sold animals shall remain visible in historical reports.

### FR-03 — Daily milk entry

The milk-entry screen shall default to today and allow previous/next date navigation. It shall support morning and evening sessions.

For each active milking animal, the user shall enter litres produced. The screen shall calculate:

- session total;
- daily total per animal;
- total farm production for the day;
- milk allocated to buyers;
- household consumption; and
- unallocated variance.

The user shall be warned when allocated milk exceeds produced milk. A daily record may be saved as draft and later marked complete.

#### Mode 01 — flat rate

The owner defines a milk rate per litre. Turnover is:

`sold litres × rate per litre`

Mode 01 is the simplest MVP entry path and should require only quantities plus the applicable rate.

#### Mode 02 — FAT/SNF quality pricing

For each session, the user records FAT % and SNF %. The workbook specifies the calculated rate per litre as:

`(FAT % × CMFAT ÷ 100) + (SNF % × CMSNF ÷ 100)`

The app shall display the calculated rate before save and preserve the FAT %, SNF %, CMFAT, CMSNF, and calculated rate used for that record so later configuration changes do not rewrite history.

### FR-04 — Milk allocation and sales

The user shall allocate produced milk by session to:

- any configured buyer/customer;
- household/internal consumption; or
- an explicitly named adjustment/waste destination if enabled later.

Buyer names and count shall be configurable; the app must not assume exactly two buyers. The app shall show produced, allocated, and remaining litres before completion.

Each sale record shall store date, session, buyer, quantity, rate, and amount. The default rate may come from the day's milk-pricing mode but can be overridden by an authorized user, with the override retained in the audit trail.

### FR-05 — Feed entry

The user shall record a feed transaction with:

- date;
- animal category and optional individual animal;
- feed item;
- quantity and unit;
- rate per unit/package;
- calculated total; and
- optional supplier/comment.

Total shall be calculated as `quantity × rate`. The user shall be able to see and edit the dated transaction history.

### FR-06 — Medicine and veterinary entry

The user shall record treatment with:

- date;
- animal;
- medicine;
- dose and dose unit;
- veterinary/doctor fee;
- medicine or treatment cost;
- calculated total; and
- comment.

The calculation must use explicitly configured cost fields; the workbook does not make clear whether doctor fee alone or doctor fee plus medicine cost forms the total. The chosen rule must be confirmed before implementation.

### FR-07 — Product/miscellaneous entry

The user shall record a product or miscellaneous transaction with date, item, quantity, unit, rate, calculated total, category, and optional comment/supplier.

The product category shall distinguish operating expense, farm investment/asset, and any future saleable by-product so finance reports do not combine unlike transactions.

### FR-08 — Heat events

The workbook exposes a `Heat` action but does not define its form. The minimum event shall store animal, observed date/time, observed signs or note, status, and optional follow-up date.

Phase 2 may link heat events to insemination, pregnancy checks, and calving.

### FR-09 — Daily dashboard

For the selected date, Home shall show:

- morning and evening litres;
- total milk produced;
- milk sold by buyer;
- household consumption;
- unallocated milk;
- turnover;
- operating cost;
- profit;
- investment/asset spending;
- cash in hand, if its opening-balance rule is configured; and
- alerts for incomplete milk entry or invalid allocation.

The workbook uses `Turn Over`, `Cost`, `Profit`, `Invest`, `Consume`, and `In-Hand`. These shall be normalized in the UI to `Turnover`, `Operating cost`, `Profit`, `Investment`, `Household consumption`, and `Cash in hand` after the owner confirms the intended meanings.

### FR-10 — Sales report

The sales report shall support a date range and display:

- total production by morning/evening;
- quantities allocated to each buyer by morning/evening;
- household consumption by morning/evening;
- daily and period totals; and
- drill-down to source entries.

### FR-11 — Finance report

The finance report shall support a date range and show:

- milk revenue by buyer;
- household-consumption value, displayed separately from cash revenue;
- feed, medicine/veterinary, product/miscellaneous, and investment costs;
- total operating cost;
- operating profit = cash revenue − operating cost;
- optional economic profit = total production value − operating cost; and
- cash in hand only when opening balance and cash movements are available.

All formulas shall be documented in the UI. Household consumption must not silently count as both cash revenue and an expense.

### FR-12 — Milk productivity report

The report shall show daily and period milk production per animal, total herd production, and morning/evening breakdown. It shall support animal and date filters and make missing entries visually distinct from true zero production.

### FR-13 — History and corrections

Users shall be able to search/filter transactions by date, animal, category, and buyer. Authorized users shall be able to correct or void a record while preserving:

- original creation time and creator;
- last update time and updater;
- previous value or a change-log entry; and
- void reason where applicable.

### FR-14 — Export, backup, and restore

The app shall export reports to CSV at minimum. Before production use, the MVP shall also provide a recoverable backup/restore path for all local data. PDF report export is optional.

## 7. Business rules and calculations

| Rule | Definition |
| --- | --- |
| Daily animal production | morning litres + evening litres |
| Daily farm production | sum of active animals' recorded production |
| Allocated milk | sum of buyer allocations + household consumption |
| Unallocated milk | farm production − allocated milk |
| Flat-rate sale amount | sold litres × effective rate/litre |
| Mode 02 rate/litre | `(FAT% × CMFAT / 100) + (SNF% × CMSNF / 100)` |
| Transaction total | quantity × rate, plus any explicitly configured extra charge |
| Operating profit | cash milk revenue − operating costs |
| Economic profit | production value − operating costs; optional and labelled separately |

Rules must be calculated from stored source values, not from rounded display values. Monetary results should be stored with sufficient precision and displayed to two decimals. Milk should accept at least two decimal places.

The workbook contains a broken `#REF!` formula for consumption in its early mockup. The app must use the normalized definitions above and must not copy broken spreadsheet references.

## 8. Validation and error handling

- Animal tag/name must be unique within a farm.
- Quantities, rates, FAT %, SNF %, fees, and totals cannot be negative.
- FAT and SNF ranges shall be configurable or initially validated against owner-approved limits.
- The same animal/session/date combination shall not be entered twice without an explicit edit/override flow.
- Allocation cannot exceed production unless an authorized adjustment is recorded.
- Required master data must be active on the transaction date.
- Calculated totals must update immediately when quantity, rate, or fee changes.
- Failed saves shall keep entered values on screen and clearly explain the error.
- Offline records shall never disappear because synchronization is unavailable.

## 9. Data model

Minimum logical entities:

| Entity | Key fields and relationships |
| --- | --- |
| Farm | id, name, currency, timezone, units, milk mode |
| User | id, farmId, name, role, active |
| Animal | id, farmId, tag/name, category, sex, status, metadata |
| Buyer | id, farmId, name, contact, active, default rate |
| Item | id, farmId, type (`feed`, `medicine`, `product`), name, unit, active |
| Pricing configuration | farmId, mode, flat rate, CMFAT, CMSNF, effective dates |
| Milk record | farmId, animalId, date, session, litres, FAT, SNF, pricing snapshot, status |
| Milk allocation | milk day/session, destination type, buyerId, litres, rate, amount |
| Feed transaction | date, animal/category, item, quantity, unit, rate, total |
| Treatment | date, animalId, medicine, dose, doctor fee, treatment cost, total, comment |
| Product transaction | date, animal/category, item, transaction category, quantity, rate, total |
| Heat event | animalId, observedAt, note, status, followUpAt |
| Audit entry | entity type/id, action, before/after, actor, timestamp |

Every transactional entity shall use a stable UUID, `createdAt`, `updatedAt`, and a soft-delete/void mechanism.

## 10. UX requirements

- Optimize primary entry flows for one-handed use on a phone.
- Default dates and sessions intelligently but always show them before save.
- Keep Morning and Evening visually distinct and show running totals.
- Use searchable pickers for animals, buyers, and items; remember recent selections.
- Use a numeric keypad for quantities, percentages, rates, and fees.
- Require confirmation for destructive corrections, not for ordinary saves.
- Surface a success state and provide an immediate `Undo` or `Edit` route.
- Use accessible contrast, scalable text, labelled controls, and touch targets of at least 44×44 points.
- Support light and dark appearance if it does not delay core workflows.

## 11. Non-functional requirements

### Reliability and offline behavior

- Core entry, history, and current-device reports shall work offline.
- A save shall be atomic: related milk and allocation records must not be partially committed.
- The app shall survive interruption or process termination without corrupting saved data.

### Performance

- Open the Home screen in under two seconds for a typical single-farm dataset on a mid-range Android device.
- Save a normal entry in under one second locally.
- Lists should remain responsive with at least five years of daily records for 100 animals.

### Security and privacy

- Do not log sensitive farm or personal data in production diagnostics.
- Protect cloud backups and API traffic with authenticated, encrypted transport when synchronization is added.
- Support local app lock/PIN in Phase 2 if devices are shared.

### Localization

- Keep all user-facing strings centralized for future Punjabi, Hindi, and English translations.
- Make currency, date display, number formatting, and units configurable without changing stored raw values.

## 12. Technical constraints and recommended architecture

The existing project uses Expo 57, React Native 0.86, React 19, TypeScript strict mode, Expo Router, and typed routes. It is currently the default starter scaffold and contains no dairy domain implementation.

Recommended implementation boundaries:

- **Routes/screens:** Expo Router under `src/app`.
- **Domain layer:** pure TypeScript calculations and validation, independent of UI.
- **Local data:** an on-device relational store such as SQLite, with schema migrations.
- **Repositories/services:** isolate persistence so cloud synchronization can be added later.
- **Forms:** reusable field and form components with schema-based validation.
- **Reports:** query stored source transactions; never persist report totals as the only source of truth.
- **Tests:** unit-test all business formulas and validation; integration-test save/edit/void workflows.

No backend is required to prototype the MVP, but production multi-device use requires a defined authentication, backup, conflict-resolution, and synchronization design.

## 13. MVP acceptance criteria

The MVP is ready for pilot use when:

1. An owner can configure a farm, at least two animals, two buyers, and reusable feed/medicine/product items.
2. A worker can enter morning and evening milk for a selected date in Mode 01.
3. Mode 02 correctly calculates rate/litre from stored FAT, SNF, CMFAT, and CMSNF inputs.
4. Milk can be allocated among any number of configured buyers and household consumption, with a visible variance.
5. Feed, treatment, product, and heat events can be created, viewed, edited, and voided.
6. Dashboard figures reconcile with underlying transactions for a test month.
7. Sales, finance, and productivity reports filter by date and drill down to source records.
8. The app remains usable offline and retains data after restart.
9. CSV export and a tested backup/restore workflow are available.
10. Automated tests cover both milk modes, totals, allocation limits, profit calculations, duplicate prevention, and missing-versus-zero production.

## 14. Proposed delivery plan

### Milestone 1 — Foundation

- Replace starter routes with the application shell.
- Establish theme, navigation, local database, migrations, and shared form components.
- Build farm settings and master data for animals, buyers, and items.

### Milestone 2 — Daily operations

- Build Mode 01 milk entry, session totals, allocation, history, and daily completion.
- Add feed, medicine/veterinary, product, and heat forms.
- Add dashboard reconciliation and correction flows.

### Milestone 3 — Quality pricing and reporting

- Build Mode 02 and its pricing configuration/snapshots.
- Add sales, finance, and productivity reports.
- Add CSV export, backup/restore, and pilot data checks.

### Milestone 4 — Production hardening

- Accessibility, performance, error recovery, and audit testing.
- Pilot with real farm data and reconcile results against the workbook for an agreed period.
- Resolve feedback and prepare signed release builds.

## 15. Decisions required before implementation

1. Does the farm use Mode 01, Mode 02, or switch mode by day/buyer/session?
2. Are CMFAT and CMSNF fixed farm settings, buyer-specific values, or effective-dated values?
3. Are FAT and SNF recorded once per session, per animal, or per buyer/delivery?
4. What do `Invest`, `Consume`, and `In-Hand` mean operationally, and what exact formulas should be used?
5. Does `Product` mean farm supplies/expenses, milk by-products sold, or both?
6. Should feed entries represent purchases, consumption by animals, or both as separate transaction types?
7. Is medicine cost separate from doctor fee, and how is treatment total calculated?
8. Which heat/breeding fields are required for the first release?
9. Is the first production release single-device only, or is cloud sync required from day one?
10. Which languages are required for the pilot?

Until these decisions are confirmed, implementation should use the explicit assumptions in this document and keep the affected rules configurable.
