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
| C6-03 | [ ] Open | Replace the milk-rate calculator formula. | Exact formula: `((FAT × CMFAT) / 100) + ((SNF × CMSNF) / 100)`. Do not change other calculator fields or behavior. |
| C6-04 | [ ] Open | Use dark-red text for entered/saved Milk page values. | Apply only to entered values, not empty placeholders, across animal milk, buyer milk, FAT, and SNF. Preserve all entry, selection, editing, and save behavior. |
| C6-05 | [ ] Open | Restore suggestion swipe, without sliding animation. | Remove Previous/Next buttons. Restore left/right swipe for adjacent ranges with immediate, non-animated replacement. Keep the three-column by ten-row grid and automatic selection flow. |
| C6-06 | [ ] Open | Add Recent Activity date-range filtering in Farm Operation. | Apply to Feed, Product, Treatment, Investment, and Silage. Provide 1/6/12 months and custom From/To calendar dates. Show the selected category/range total spending as the first row. View/filter only; do not mutate activity data or existing behavior. |
| C6-07 | [ ] Open | Expand Recent Activity search and add search scope. | Search all stored textual/numeric activity information (including notes, prices, rates, unit, quantities and void reasons). Scope choices: Selected Date Range or Entire Record. Keep existing records and activity behavior unchanged. |
| C6-08 | [ ] Open | Add Total Milk at top of Buyer Account's 10-day milk record. | Sum morning plus evening only for the selected cycle. Recalculate when Previous/Next changes; preserve daily rows, navigation, and CSV export. |

## Round 7

| ID | Status | Client request | Scope and acceptance criteria |
|---|---|---|---|
| C7-01 | [ ] Open | Make Buyer milk suggestions increment by 0.5 L. | Buyer suggestions only: 30.0, 30.5, 31.0 ... Keep animal suggestions and swipe/selection behavior unchanged. |
| C7-02 | [ ] Open | Sort Buyer Account and Reports FAT/SNF rows oldest to newest. | Buyer 10-day daily entries and Reports FAT/SNF record view must display ascending date order only; no other functional change. |
| C7-03 | [ ] Open | Add a Household Consumption page from Milk Entry. | Tapping Household Consumption opens a monthly-only view: total consumed milk, editable monthly rate, calculated total amount, and separately saved self-payment. No daily entries displayed. Existing Milk Entry household allocation remains the source of consumption volume. |

## Implementation order

1. Verify C6-01/C6-02 against current behavior and correct only if needed.
2. Implement small isolated UI/calculation changes: C6-03, C6-04, C6-08, C7-01, C7-02.
3. Restore the gesture-based picker carefully for C6-05; test animal, buyer, FAT, and SNF flows.
4. Implement Farm Operation filtering/search for C6-06/C6-07.
5. Design and implement the new persisted monthly Household Consumption flow for C7-03, including its database migration and PowerSync stream changes.
