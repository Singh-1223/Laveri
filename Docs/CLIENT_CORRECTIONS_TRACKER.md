# Client Corrections Tracker

Source: `App Corrections_260903_121256.pdf`, received 2026-09-03.

## Status key

- `[ ] Open` - not implemented yet.
- `[~] Partial` - some related UI/data exists, but it does not meet the client request.
- `[x] Done` - implemented and accepted after client retest.
- `[>] Implemented` - code complete and code-checked; awaiting client retest.
- `[?] Decision needed` - client confirmation is needed before implementation because it changes business rules or data behaviour.
- `[–] Not applicable` - superseded by a clarified client requirement; no implementation is needed for this item.

**Current summary:** 0 done, 13 implemented awaiting retest, 0 partial, 5 open, 1 not applicable. No item is marked done until it is implemented and the client retests it.

## Confirmed client decisions - 2026-09-03

1. Milk not assigned to a buyer always becomes **Household consumption**.
2. Feed, Product, Medicine, and Treatment are all collective farm-level **production costs**. They are not investments, and no Investment classification or inference is needed.
3. Milk data must auto-save after **every field** entry.
4. Every buyer has a fixed, manual per-litre rate. Only **Verka** is an exception because its rate is finalized after the billing cycle.
5. Verka handling is for **Cow milk only**.
6. A common treatment has one shared medicine quantity and price across all selected animals.
7. Animal labels must be **custom labels** created by the user.

## Phase 1 - Daily entry usability

| ID | Status | Client request | Current state / scope |
|---|---|---|---|
| C-01 | [>] Implemented | Keep the currently edited input visible above the keyboard on all screens. | The shared AppScreen now uses platform keyboard avoidance, keyboard inset adjustment, and a keyboard-aware scroll view for all standard forms. Awaiting client retest on the target devices. |
| C-02 | [>] Implemented | Allow the user to choose the order of cows and buyers in Milk entry. | Master data now provides Move up/Move down for Animals and Buyers. The persisted order is used by Milk entry. Migration `202609030001_master_display_order.sql` must be pushed to Supabase before building/testing this change. Awaiting client retest. |
| C-03 | [>] Implemented | Remove the remaining-milk field and automatically put remaining milk into Household consumption. | Buyer allocations are the only editable allocations. The repository calculates, displays, and saves Household consumption as produced minus buyer litres; it also removes a former Household allocation when the calculated value becomes zero. Awaiting client retest. |
| C-04 | [–] Not applicable | Remove Product categories Operating and Investment. | **Clarified:** this is not a required change. Product, Feed, Medicine, and Treatment are all production costs; do not add Investment handling or an inference rule. |
| C-05 | [ ] Open | Display dates as `DD-MM-YY`. | Store ISO dates internally for safe calculations/sync, but display `DD-MM-YY` consistently in the app and reports. |
| C-06 | [>] Implemented | Remove the Milk Save button and save each entered value immediately; do not lose partial entry when leaving/reopening Milk. | The Save button is removed. Valid edits are debounced briefly and then saved locally per field. Repository upserts by animal/date/session and buyer/date/session so repeated auto-saves update records rather than duplicating them. Awaiting client retest. |
| C-07 | [>] Implemented | In Expenses, show recent activity separately for Feed, Treatment, Product, and Heat. | Recent activity now starts on Feed and automatically follows the active operation tab. The user can still choose another history filter. Awaiting client retest. |
| C-08 | [>] Implemented | On app launch, open Milk entry automatically. If today is complete, open today’s Morning before noon or Evening after noon; otherwise open the first incomplete session. | The initial tab is Milk. A session is considered complete when every active milking animal has an entry. On launch, the app resumes the latest incomplete session; otherwise it chooses today’s Morning before noon or Evening after noon. Awaiting client retest. |
| C-09 | [ ] Open | Configurable reminders for missing Morning/Evening entries, for example 9 AM and 9 PM. | Requires notification permission, local scheduled notifications, settings UI, and completion checks. |

## Phase 2 - Milk, buyer billing, and payments

| ID | Status | Client request | Current state / scope |
|---|---|---|---|
| C-10 | [>] Implemented | Milk rates are buyer-specific; remove the common Flat/Quality pricing choice from Milk entry and keep the rate calculation only as a simple calculator. | Buyer rates are maintained in Master data and copied into every buyer allocation with its calculated amount. The shared Milk rate flow is removed. Verka can be allocated at ₹0 until billing-cycle pricing is finalized. Awaiting client retest. |
| C-10.1 | [>] Implemented | Record FAT% and SNF% daily for reference, not to calculate the common milk rate. Show it between Animals and Allocation. | FAT% and SNF% are now a separate Daily milk quality section between Animals and Buyer allocation. They are saved with milk production and do not calculate buyer pricing. Awaiting client retest. |
| C-10.2 | [ ] Open | Tapping a buyer opens that buyer’s account: rate input, payment entries with date, pending balance, 10-day milk table, and payment table. | New buyer-ledger module: buyer details, per-allocation rate, payments, pending-balance calculation, and 10-day navigation. |
| C-10.3 | [ ] Open | Special **Verka** billing: rate known after each 10-day billing cycle; commission/increments/deductions; edit previous-cycle rate; retain prior rate until updated; upload bill. | **Approved:** Verka covers Cow milk only. Build a Cow-milk 10-day billing-cycle module with adjustments, bill attachment in Supabase Storage, and controlled correction history. This depends on C-10.2. |

## Phase 3 - Expenses and treatments

| ID | Status | Client request | Current state / scope |
|---|---|---|
| C-11 | [>] Implemented | Feed/Product entry should be common to all animals; do not require an animal. Enter name, quantity, unit, price/unit, visible comment. Allow new items directly in Expenses and save them for future suggestions. | Feed and Product are farm-wide, without an animal choice. The form can create new Feed/Product items directly, saved items are available as reusable choices, and comments display in recent activity. Awaiting client retest. |
| C-12 | [>] Implemented | Treatment should allow multiple animals and Select all. Enter medicine name, quantity/unit, units, and price/unit; allow quick-create medicine and prior-item suggestions. | One treatment record links multiple selected animals, including Select all. Quantity/unit and shared cost are stored once; medicine items can be created directly in the form and retained as reusable choices. Awaiting client retest. |

## Phase 4 - Animal organization and history

| ID | Status | Client request | Current state / scope |
|---|---|---|
| C-13 | [>] Implemented | Make animal categories editable; allow more than one category per animal; add coloured category tags. | The Animal editor creates custom coloured labels and assigns multiple labels per animal. Definitions and links are offline-first and synchronize through the queued migration/PowerSync stream. Awaiting client retest. |
| C-14 | [>] Implemented | Simplify Herd: keep All, remove the redundant Cows tab, and show category tags/colours next to every animal. | Herd is one All-animals list with each animal’s selected custom coloured labels displayed as chips. Awaiting client retest. |
| C-15 | [>] Implemented | Suggest previously entered Heat observed signs. | Non-voided Heat notes are loaded from local history and shown as one-tap suggestions in the Heat form. Awaiting client retest. |
| C-16 | [ ] Open | Give every animal a detailed history/profile: birth, purchase, lactation, calving, heat, treatment, all relevant expense events, custom events, and photos. | Major animal-profile module. Requires new lifecycle/event tables, animal-event timeline, photo storage, new profile screen, and links from treatment/heat/expenses. |

## Recommended implementation order

We should complete and client-test one group at a time:

1. **Daily usability:** C-01, C-02, C-05, C-07, C-08.
2. **Confirmed business-rule implementation:** C-03, C-06, C-10.
3. **Expense/treatment workflow:** C-11, then C-12.
4. **Buyer billing and Verka:** C-10.1, C-10.2, then C-10.3.
5. **Animal organization/history:** C-13, C-14, C-15, then C-16.
6. **Reminders:** C-09 after the definition of a completed Milk session is agreed.

## Completed items

No correction from this PDF is fully completed yet. Add completed items here only after implementation, code checks, a new APK build, and client retest.
