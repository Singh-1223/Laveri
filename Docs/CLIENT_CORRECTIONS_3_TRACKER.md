# Client Corrections - Round 3 Tracker

Source: `App correction 3_260907_091442.pdf`, received 2026-09-07.

## Status key

- `[ ] Open` - not implemented yet.
- `[~] Verify/rework` - overlaps an earlier implementation but needs comparison with this clarified request.
- `[>] Implemented` - code complete and code-checked; awaiting client retest.
- `[x] Done` - accepted after client retest.
- `[?] Decision needed` - a business rule or design choice is not yet specified.

**Current summary:** 12 open items, 2 verify/rework items, 2 decisions needed, and 9 implemented awaiting retest. Three clarifications are recorded below. No Round 3 item is marked done until client retest.

## A. Milk entry interaction and layout

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R3-01 | [>] Implemented | Show quantity suggestions in three columns instead of one. | The picker now uses one vertically scrolling three-column grid, preserves the configured ranges and selection logic, and highlights the current value. Awaiting client retest. |
| R3-02 | [>] Implemented | Replace Milk animal up/down buttons with drag-and-drop row ordering. | Press/hold and drag the complete animal row. The Milk-specific order is persisted and the arrow controls are removed. Awaiting client retest. |
| R3-03 | [>] Implemented | Apply the same drag-and-drop ordering to buyers. | Press/hold and drag buyer allocation rows. Buyer display order is persisted and used when reopening Milk. Awaiting client retest. |
| R3-04 | [>] Implemented | Increase buyer-allocation suggestions to 0.0-100.0. | Buyer allocation now uses 0.0-100.0 in 0.1 litre increments (1,001 values) within the three-column picker. Awaiting client retest. |
| R3-05 | [>] Implemented | Put Sync and the three-dot menu side-by-side in the Milk top-right corner. | Header actions now share one horizontal row, preserving both actions with spacing. Awaiting client retest. |
| R3-06 | [>] Implemented | Keep FAT% and SNF% beside each other on one row. | The existing shared-row layout is retained and compact field padding prevents unnecessary wrapping. Awaiting client retest. |
| R3-07 | [>] Implemented | Reduce milk, buyer, FAT%, and SNF% input widths to half their current width. | Milk and buyer input boxes are reduced from 96 to 52 points; FAT/SNF fields retain their shared compact row. Awaiting client retest. |
| R3-08 | [>] Implemented | Visually distinguish entered/saved quantity values from empty values. | Entered quantities now use the primary colour while empty fields retain secondary placeholder styling. Awaiting client retest. |
| R3-09 | [>] Implemented | Make animal and buyer names on Milk directly clickable. | Animal names open the Herd profile; buyer names open the buyer account. Quantity picker actions remain separate. Awaiting client retest. |

## B. Herd and animal profile

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R3-10 | [ ] Open | Separate the animal profile picture from other uploaded photos/documents. | Support exactly one replaceable profile picture, shown before the animal name. Keep other files as dated history attachments. |
| R3-11 | [ ] Open | Add a date to each non-profile image/document and show it in History. | The user chooses the attachment date; history placement follows that date. |
| R3-12 | [ ] Open | Show newest animal history first. | Sort all profile history entries descending by their effective event/attachment date. |
| R3-13 | [ ] Open | Filter Herd by label tabs such as All, Milking, PND, CVD, Dry, Calf/Heifer. | Generate selectable label tabs from saved labels; All shows every animal and a label shows animals having that label. Preserve search and labels. |
| R3-14 | [ ] Open | Drag-and-drop reorder the Herd label tabs. | Persist label-tab order independently; do not change animal ordering or label assignments. |
| R3-15 | [ ] Open | Show each animal's own milk history as a line graph. | Combine Morning + Evening into one daily total point. Add 7-day, 1-month, 3-month, and custom-range controls, plus practical horizontal scrolling/zoom behaviour. Do not display other animals' milk in that profile. |

## C. Farm operations

| ID | Status | Client request | Implementation scope |
|---|---|---|
| R3-16 | [ ] Open | Put newest activity first in Farm Operations history. | Sort same-day and older entries by latest creation/entry time first. |
| R3-17 | [ ] Open | Add Other events, modelled on Heat event. | Add injury/mishap/general-event entry with Heat-event-like date/notes flow, while allowing one, many, or all animals to be selected. |
| R3-18 | [ ] Open | Reorder Farm Operations tabs. | Set fixed order: Feed, Product, Treatment, Heat event, Investment, Silage, Other events. |

## D. Buyer accounts and pricing

| ID | Status | Client request | Implementation scope |
|---|---|---|
| R3-19 | [ ] Open | Simplify the 10-day buyer milk list. | Remove daily money amounts. Combine Morning and Evening into one row per date using `M - … | E - …`, while retaining date and quantity. |
| R3-20 | [~] Verify/rework | Verka needs a special prior-cycle rate input and must retain the previous rate until changed. | Compare the existing Verka billing-cycle editor with this request, including previous-cycle selection/editing and the rate used in revenue calculations. |
| R3-21 | [ ] Open | Let Master Data update a buyer's rate for a selected inclusive date range. | Add start date, end date, new per-litre rate, validation, confirmation, and a controlled bulk update of applicable milk allocations. |
| R3-22 | [?] Decision needed | Upload a milk bill and compare app data; calculate rate from bill totals. | Compare only Morning, Evening, and Total milk. Capture bill `Total amount`, `Corpus A/C`, and `Total milk quantity`; calculate rate as `(Total amount - Corpus A/C) / Total milk quantity`. Retain bill attachment/opening. The intended buyer scope must be confirmed. |
| R3-23 | [?] Decision needed | Add a Verka daily balance/shortfall indicator on Milk. | The formula is cumulative supplied milk minus 100 kg per day, with target adjusted by shift length. Need confirmation of the cycle start/end rule and whether “supplied” means only milk allocated to the buyer named Verka. |

## E. Reports and formatting

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R3-24 | [ ] Open | Display recorded FAT% and SNF% in Reports. | Add a report view/filter for the Milk-page FAT/SNF records, with the appropriate date/session context. |
| R3-25 | [ ] Open | Fix Heat event date formatting in animal history. | Show a human-readable farm date such as `DD-MM-YY`, rather than an ISO timestamp. |

## Clarifications to obtain before implementation

1. **Verka target cycle** - source: **“VERKA Milk Target - Use This Formula”** (pages 7-8). Does the cumulative 100 kg/day target run from the 1st-10th, 11th-20th, and 21st-end-of-month, or is there another start-date rule? Does “Actual milk supplied” count only milk allocated to the buyer called Verka?
2. **Bill comparison scope** - source: **“Upload bills and compare”** (page 7), immediately followed by **“VERKA Milk Target - Use This Formula.”** Is the new Total amount/Corpus A/C rate calculation only for Verka, or should every buyer have bill upload and comparison?
3. **Other events fields** - source: **“Farm Operation - make copy of 'heat event'”** (page 5). Besides the Heat-event-like date/notes flow and selecting one/many/all animals, are any structured fields required: event type, cost, follow-up date, status, or attachments?

## Suggested delivery order

1. Milk interaction/layout: R3-01 to R3-09.
2. Operations and buyer-account presentation: R3-16 to R3-21.
3. Herd/profile and reporting: R3-10 to R3-15, R3-24 to R3-25.
4. Verka bill/target work: R3-22 to R3-23 after the three clarifications above.

## Completion rule

Move an item to `[>] Implemented` only after code checks pass. Move it to `[x] Done` only after the client tests the new APK and confirms the behaviour.
