# Client Corrections Tracker

Source: `App Corrections_260903_121256.pdf`, received 2026-09-03.

## Status key

- `[ ] Open` - not implemented yet.
- `[~] Partial` - some related UI/data exists, but it does not meet the client request.
- `[x] Done` - implemented and accepted after client retest.
- `[?] Decision needed` - client confirmation is needed before implementation because it changes business rules or data behaviour.
- `[-] Rule needed` - the client direction is known, but an exact data/reporting rule is still required before coding.

**Current summary:** 0 done, 4 partial, 14 open, 1 rule needed. No item is marked done until it is implemented and the client retests it.

## Confirmed client decisions - 2026-09-03

1. Milk not assigned to a buyer always becomes **Household consumption**.
2. Remove the Operating/Investment entry selector. Investment must be inferred by another rule; the exact rule is still required.
3. Milk data must auto-save after **every field** entry.
4. Every buyer has a fixed, manual per-litre rate. Only **Verka** is an exception because its rate is finalized after the billing cycle.
5. Verka handling is for **Cow milk only**.
6. A common treatment has one shared medicine quantity and price across all selected animals.
7. Animal labels must be **custom labels** created by the user.

## Phase 1 - Daily entry usability

| ID | Status | Client request | Current state / scope |
|---|---|---|---|
| C-01 | [ ] Open | Keep the currently edited input visible above the keyboard on all screens. | Add keyboard-aware layout and scroll-to-focused-input behaviour to entry forms. |
| C-02 | [ ] Open | Allow the user to choose the order of cows and buyers in Milk entry. | Add a stored display-order field plus up/down or drag reordering in Master data. |
| C-03 | [ ] Open | Remove the remaining-milk field and automatically put remaining milk into Household consumption. | **Approved:** all milk not assigned to a buyer becomes Household consumption. Replace the editable Household quantity and Remaining display with a calculated Household value. |
| C-04 | [-] Rule needed | Remove Product categories Operating and Investment. | **Approved direction:** remove the selector and infer Investment another way. Define the exact inference rule before changing reports or existing records. |
| C-05 | [ ] Open | Display dates as `DD-MM-YY`. | Store ISO dates internally for safe calculations/sync, but display `DD-MM-YY` consistently in the app and reports. |
| C-06 | [ ] Open | Remove the Milk Save button and save each entered value immediately; do not lose partial entry when leaving/reopening Milk. | **Approved:** save after every field. Implement debounced field-level local saves, preserve partial sessions, and synchronize safely without exposing half-entered records as final totals. |
| C-07 | [~] Partial | In Expenses, show recent activity separately for Feed, Treatment, Product, and Heat. | The screen has filter chips, but it starts at All and does not automatically show only the active operation tab. Make recent activity follow the selected tab by default. |
| C-08 | [ ] Open | On app launch, open Milk entry automatically. If today is complete, open today’s Morning before noon or Evening after noon; otherwise open the first incomplete session. | Requires startup routing and a clear definition of “complete” for a session. |
| C-09 | [ ] Open | Configurable reminders for missing Morning/Evening entries, for example 9 AM and 9 PM. | Requires notification permission, local scheduled notifications, settings UI, and completion checks. |

## Phase 2 - Milk, buyer billing, and payments

| ID | Status | Client request | Current state / scope |
|---|---|---|---|
| C-10 | [ ] Open | Milk rates are buyer-specific; remove the common Flat/Quality pricing choice from Milk entry and keep the rate calculation only as a simple calculator. | **Approved:** each buyer has a fixed manual per-litre rate; Verka is the only delayed-rate exception. Save rate and amount per buyer allocation. |
| C-10.1 | [~] Partial | Record FAT% and SNF% daily for reference, not to calculate the common milk rate. Show it between Animals and Allocation. | Current app captures FAT/SNF only in Quality pricing and uses it for rate calculation. Move it to a separate daily quality section and preserve it independently of billing. |
| C-10.2 | [ ] Open | Tapping a buyer opens that buyer’s account: rate input, payment entries with date, pending balance, 10-day milk table, and payment table. | New buyer-ledger module: buyer details, per-allocation rate, payments, pending-balance calculation, and 10-day navigation. |
| C-10.3 | [ ] Open | Special **Verka** billing: rate known after each 10-day billing cycle; commission/increments/deductions; edit previous-cycle rate; retain prior rate until updated; upload bill. | **Approved:** Verka covers Cow milk only. Build a Cow-milk 10-day billing-cycle module with adjustments, bill attachment in Supabase Storage, and controlled correction history. This depends on C-10.2. |

## Phase 3 - Expenses and treatments

| ID | Status | Client request | Current state / scope |
|---|---|---|
| C-11 | [~] Partial | Feed/Product entry should be common to all animals; do not require an animal. Enter name, quantity, unit, price/unit, visible comment. Allow new items directly in Expenses and save them for future suggestions. | Current Feed requires one animal; Product allows optional animal. Both require Master data first. Make feed/product farm-level, add quick-create item entry, retain comments in history, and suggest prior items. |
| C-12 | [ ] Open | Treatment should allow multiple animals and Select all. Enter medicine name, quantity/unit, units, and price/unit; allow quick-create medicine and prior-item suggestions. | **Approved:** one medicine quantity and price are shared across all selected animals. Requires a treatment header plus multiple animal links, quantity/unit fields, quick-create medicine, and reporting/audit changes. |

## Phase 4 - Animal organization and history

| ID | Status | Client request | Current state / scope |
|---|---|---|
| C-13 | [~] Partial | Make animal categories editable; allow more than one category per animal; add coloured category tags. | **Approved:** labels are user-created custom labels. Current categories are one fixed value: Cow, Heifer, or Calf. The selected type remains visible correctly, but editable/multiple labels and colours are not implemented. Requires tags/categories data model and UI. |
| C-14 | [ ] Open | Simplify Herd: keep All, remove the redundant Cows tab, and show category tags/colours next to every animal. | Update Herd filters and implement the tag display after C-13. |
| C-15 | [ ] Open | Suggest previously entered Heat observed signs. | Add history-based suggestions to the Heat note field. |
| C-16 | [ ] Open | Give every animal a detailed history/profile: birth, purchase, lactation, calving, heat, treatment, all relevant expense events, custom events, and photos. | Major animal-profile module. Requires new lifecycle/event tables, animal-event timeline, photo storage, new profile screen, and links from treatment/heat/expenses. |

## Recommended implementation order

We should complete and client-test one group at a time:

1. **Daily usability:** C-01, C-02, C-05, C-07, C-08.
2. **Confirm business-rule decisions:** C-03, C-04, C-06, C-10.
3. **Expense/treatment workflow:** C-11, then C-12.
4. **Buyer billing and Verka:** C-10.1, C-10.2, then C-10.3.
5. **Animal organization/history:** C-13, C-14, C-15, then C-16.
6. **Reminders:** C-09 after the definition of a completed Milk session is agreed.

## Remaining rule to confirm before implementation

1. With the Operating/Investment selector removed, what exact rule should identify an Investment? For example: a separate product label, a configurable item type, a value threshold, or a dedicated report-only classification.

## Completed items

No correction from this PDF is fully completed yet. Add completed items here only after implementation, code checks, a new APK build, and client retest.
