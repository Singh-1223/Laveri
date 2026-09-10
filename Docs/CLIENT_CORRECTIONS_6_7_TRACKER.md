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
| C6-01 | [~] Verify | Update a regular buyer's previously saved milk rate by inclusive From/To dates. | Master Data > Buyers > Edit Buyer. Update only that buyer's allocations inside the inclusive range; preserve quantities, FAT/SNF, and all other data. Existing feature must be retested against the stated example. |
| C6-02 | [~] Verify | Change Verka target to cumulative supplied milk minus days completed × 100 kg. | Show daily cumulative balance, allowing shortages to be recovered by later higher supply. Target must be 900/1,000/1,100 kg for 9/10/11-day shifts and only include Verka allocations. Existing feature must be checked against the day-6 and recovery examples. |
| C6-03 | [>] Implemented | Replace the milk-rate calculator formula. | Calculator now uses the exact requested formula and accepts coefficients in the requested 415/287 form. Awaiting device retest. |
| C6-04 | [>] Implemented | Use dark-red text for entered/saved Milk page values. | Entered animal, buyer, FAT, and SNF values use a readable dark-red tone in Light theme and accessible red in Dark theme; placeholders remain unchanged. Awaiting device retest. |
| C6-05 | [>] Implemented | Restore suggestion swipe, without sliding animation. | Previous/Next buttons are removed. A horizontal swipe changes to the adjacent range immediately without a slide animation, while preserving the grid and automatic selection flow. Awaiting device retest. |
| C6-06 | [ ] Open | Add Recent Activity date-range filtering in Farm Operation. | Apply to Feed, Product, Treatment, Investment, and Silage. Provide 1/6/12 months and custom From/To calendar dates. Show the selected category/range total spending as the first row. View/filter only; do not mutate activity data or existing behavior. |
| C6-07 | [ ] Open | Expand Recent Activity search and add search scope. | Search all stored textual/numeric activity information (including notes, prices, rates, unit, quantities and void reasons). Scope choices: Selected Date Range or Entire Record. Keep existing records and activity behavior unchanged. |
| C6-08 | [>] Implemented | Add Total Milk at top of Buyer Account's 10-day milk record. | Total Milk appears above the selected cycle's daily rows and recalculates with Previous/Next. Awaiting device retest. |

## Round 7

| ID | Status | Client request | Scope and acceptance criteria |
|---|---|---|---|
| C7-01 | [>] Implemented | Make Buyer milk suggestions increment by 0.5 L. | Buyer suggestions now use 0.5 L increments only; animal suggestions remain at 0.1 L and the shared swipe/selection behavior is preserved. Awaiting device retest. |
| C7-02 | [>] Implemented | Sort Buyer Account and Reports FAT/SNF rows oldest to newest. | Buyer 10-day entries and Reports FAT/SNF records now sort from earliest date to latest date. Awaiting device retest. |
| C7-03 | [ ] Open | Add a Household Consumption page from Milk Entry. | Tapping Household Consumption opens a monthly-only view: total consumed milk, editable monthly rate, calculated total amount, and separately saved self-payment. No daily entries displayed. Existing Milk Entry household allocation remains the source of consumption volume. |

## Implementation order

1. Verify C6-01/C6-02 against current behavior and correct only if needed.
2. Implement small isolated UI/calculation changes: C6-03, C6-04, C6-08, C7-01, C7-02.
3. Restore the gesture-based picker carefully for C6-05; test animal, buyer, FAT, and SNF flows.
4. Implement Farm Operation filtering/search for C6-06/C6-07.
5. Design and implement the new persisted monthly Household Consumption flow for C7-03, including its database migration and PowerSync stream changes.
