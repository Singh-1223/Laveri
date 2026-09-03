# Client Corrections Tracker

Source: `App Corrections_260903_121256.pdf`, received 2026-09-03.

## Status key

- `[ ] Open` - not implemented yet.
- `[~] Partial` - some related UI/data exists, but it does not meet the client request.
- `[x] Done` - implemented and accepted after client retest.
- `[?] Decision needed` - client confirmation is needed before implementation because it changes business rules or data behaviour.

**Current summary:** 0 done, 4 partial, 11 open, 4 awaiting business decisions. No item is marked done until it is implemented and the client retests it.

## Phase 1 - Daily entry usability

| ID | Status | Client request | Current state / scope |
|---|---|---|---|
| C-01 | [ ] Open | Keep the currently edited input visible above the keyboard on all screens. | Add keyboard-aware layout and scroll-to-focused-input behaviour to entry forms. |
| C-02 | [ ] Open | Allow the user to choose the order of cows and buyers in Milk entry. | Add a stored display-order field plus up/down or drag reordering in Master data. |
| C-03 | [?] Decision needed | Remove the remaining-milk field and automatically put remaining milk into Household consumption. | Current app displays Remaining and lets Household be entered manually. Confirm that every unallocated litre must always count as household use; this removes the ability to record genuinely unallocated/wasted milk. |
| C-04 | [?] Decision needed | Remove Product categories Operating and Investment. | Current reports keep operating costs and investments separate. Confirm whether all product spending should be one common expense category and how historical investment records should be reported. |
| C-05 | [ ] Open | Display dates as `DD-MM-YY`. | Store ISO dates internally for safe calculations/sync, but display `DD-MM-YY` consistently in the app and reports. |
| C-06 | [?] Decision needed | Remove the Milk Save button and save each entered value immediately; do not lose partial entry when leaving/reopening Milk. | Current full-session Save protects the atomic milk/allocation transaction. Implement safe auto-save drafts/debounced field saves only after agreeing when a session becomes final/complete. |
| C-07 | [~] Partial | In Expenses, show recent activity separately for Feed, Treatment, Product, and Heat. | The screen has filter chips, but it starts at All and does not automatically show only the active operation tab. Make recent activity follow the selected tab by default. |
| C-08 | [ ] Open | On app launch, open Milk entry automatically. If today is complete, open today’s Morning before noon or Evening after noon; otherwise open the first incomplete session. | Requires startup routing and a clear definition of “complete” for a session. |
| C-09 | [ ] Open | Configurable reminders for missing Morning/Evening entries, for example 9 AM and 9 PM. | Requires notification permission, local scheduled notifications, settings UI, and completion checks. |

## Phase 2 - Milk, buyer billing, and payments

| ID | Status | Client request | Current state / scope |
|---|---|---|---|
| C-10 | [?] Decision needed | Milk rates are buyer-specific; remove the common Flat/Quality pricing choice from Milk entry and keep the rate calculation only as a simple calculator. | Current design applies one session rate to all buyer allocations. This requires a data-model change to save a separate rate/amount for each buyer allocation. Confirm whether all buyers use manual rate, FAT/SNF formula, or both. |
| C-10.1 | [~] Partial | Record FAT% and SNF% daily for reference, not to calculate the common milk rate. Show it between Animals and Allocation. | Current app captures FAT/SNF only in Quality pricing and uses it for rate calculation. Move it to a separate daily quality section and preserve it independently of billing. |
| C-10.2 | [ ] Open | Tapping a buyer opens that buyer’s account: rate input, payment entries with date, pending balance, 10-day milk table, and payment table. | New buyer-ledger module: buyer details, per-allocation rate, payments, pending-balance calculation, and 10-day navigation. |
| C-10.3 | [ ] Open | Special **Verka** billing: rate known after each 10-day billing cycle; commission/increments/deductions; edit previous-cycle rate; retain prior rate until updated; upload bill. | New Verka/billing-cycle module with adjustments, invoice/bill attachment in Supabase Storage, and controlled correction history. This depends on C-10.2. |

## Phase 3 - Expenses and treatments

| ID | Status | Client request | Current state / scope |
|---|---|---|
| C-11 | [~] Partial | Feed/Product entry should be common to all animals; do not require an animal. Enter name, quantity, unit, price/unit, visible comment. Allow new items directly in Expenses and save them for future suggestions. | Current Feed requires one animal; Product allows optional animal. Both require Master data first. Make feed/product farm-level, add quick-create item entry, retain comments in history, and suggest prior items. |
| C-12 | [ ] Open | Treatment should allow multiple animals and Select all. Enter medicine name, quantity/unit, units, and price/unit; allow quick-create medicine and prior-item suggestions. | Current treatment supports one animal and doctor/medicine cost only. Requires a treatment header plus multiple animal links, quantity/unit fields, quick-create medicine, and reporting/audit changes. |

## Phase 4 - Animal organization and history

| ID | Status | Client request | Current state / scope |
|---|---|---|
| C-13 | [~] Partial | Make animal categories editable; allow more than one category per animal; add coloured category tags. | Current categories are one fixed value: Cow, Heifer, or Calf. The selected type remains visible correctly, but editable/multiple categories and colours are not implemented. Requires tags/categories data model and UI. |
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

## Decisions needed from the client before we start

1. Should all milk not assigned to a buyer always become Household consumption, or can milk be unallocated/wasted/held separately?
2. If product categories are removed, should Investment disappear from reports or be inferred another way?
3. For auto-save, when is a Milk session considered final: after every field, after a complete session, or when the user explicitly marks it complete?
4. Does each buyer have a manual per-litre rate, FAT/SNF pricing, or either one? Can a buyer rate change inside a 10-day billing period?
5. Does Verka use only Cow milk, Buffalo milk, or both, and which exact invoice fields/adjustments must be entered?
6. For a common treatment, are medicine quantity and price shared once across all selected animals, or does each animal need its own dose/amount?
7. Which animal tags are needed first: for example Milking, Dry, Pregnant, Calf/Heifer, PND, CVD, or custom labels?

## Completed items

No correction from this PDF is fully completed yet. Add completed items here only after implementation, code checks, a new APK build, and client retest.
