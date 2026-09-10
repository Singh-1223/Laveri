# Client Corrections - Rounds 6 and 7 Tracker

Sources: `Correct 6_260909_232640.pdf` and `Correct 7_260910_112735.pdf`, received 2026-09-10.

## Status key

- `[ ] Open` - not implemented.
- `[~] Verify/rework` - overlaps existing work and needs confirmation or adjustment.
- `[>] Implemented` - code complete and awaiting device retest.
- `[x] Done` - accepted after client retest.

## Round 6

| ID | Status | Client request | Scope and acceptance criteria |
|---|---|---|---|
| C6-01 | [>] Verified | Update a regular buyer's previously saved milk rate by inclusive From/To dates. | Existing Master Data buyer editor updates only that buyer's allocations inside the inclusive selected range and preserves volume/quality data. Awaiting device retest against the stated example. |
| C6-02 | [>] Verified | Change Verka target to cumulative supplied milk minus days completed × 100 kg. | Existing Milk Verka indicator sums saved Verka allocations from the cycle start to the selected date, then subtracts elapsed days × 100 kg, allowing later supply to recover an earlier shortfall. Awaiting device retest. |
| C6-03 | [>] Implemented | Replace the milk-rate calculator formula. | Calculator now uses the exact requested formula and accepts coefficients in the requested 415/287 form. Awaiting device retest. |
| C6-04 | [>] Implemented | Use dark-red text for entered/saved Milk page values. | Entered animal, buyer, FAT, and SNF values use a readable dark-red tone in Light theme and accessible red in Dark theme; placeholders remain unchanged. Awaiting device retest. |
| C6-05 | [>] Implemented | Restore suggestion swipe, without sliding animation. | Previous/Next buttons are removed. A horizontal swipe changes to the adjacent range immediately without a slide animation, while preserving the grid and automatic selection flow. Awaiting device retest. |
| C6-06 | [>] Implemented | Add Recent Activity date-range filtering in Farm Operation. | Feed, Product, Treatment, Investment, and Silage can be viewed by 1/6/12 months or custom calendar dates. The selected category/range total spent appears before the activity records. Awaiting device retest. |
| C6-07 | [>] Implemented | Expand Recent Activity search and add search scope. | Search covers stored activity text and numeric fields, including notes, units, quantities, rates, prices, and void reasons. Scope choices are Selected date range and Entire record. Awaiting device retest. |
| C6-08 | [>] Implemented | Add Total Milk at top of Buyer Account's 10-day milk record. | Total Milk appears above the selected cycle's daily rows and recalculates with Previous/Next. Awaiting device retest. |

## Round 7

| ID | Status | Client request | Scope and acceptance criteria |
|---|---|---|---|
| C7-01 | [>] Implemented | Make Buyer milk suggestions increment by 0.5 L. | Buyer suggestions now use 0.5 L increments only; animal suggestions remain at 0.1 L and the shared swipe/selection behavior is preserved. Awaiting device retest. |
| C7-02 | [>] Implemented | Sort Buyer Account and Reports FAT/SNF rows oldest to newest. | Buyer 10-day entries and Reports FAT/SNF records now sort from earliest date to latest date. Awaiting device retest. |
| C7-03 | [>] Implemented | Add a Household Consumption page from Milk Entry. | Milk now opens a monthly-only Household Consumption page. It derives total litres from existing household allocations and stores each month's rate and self-payment separately; total amount is calculated automatically. Requires the new Supabase migration and PowerSync deployment before device retest. |

## Implementation order

1. Verify C6-01/C6-02 against current behavior and correct only if needed.
2. Implement small isolated UI/calculation changes: C6-03, C6-04, C6-08, C7-01, C7-02.
3. Restore the gesture-based picker carefully for C6-05; test animal, buyer, FAT, and SNF flows.
4. Implement Farm Operation filtering/search for C6-06/C6-07.
5. Design and implement the new persisted monthly Household Consumption flow for C7-03, including its database migration and PowerSync stream changes.
