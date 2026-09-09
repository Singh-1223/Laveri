# Client Corrections - Round 5 Tracker

Source: `Correction 5_260909_113806.pdf`, received 2026-09-09.

## Status key

- `[ ] Open` - not implemented.
- `[~] Verify/rework` - overlaps existing work but needs confirmation or adjustment.
- `[>] Implemented` - code complete and awaiting device retest.
- `[x] Done` - accepted after client retest.

| ID | Status | Client request | Scope |
|---|---|---|---|
| C5-01 | [~] | Apply regular buyer rate changes to inclusive historical date ranges. | Existing feature; retest. |
| C5-02 | [~] | Verka cumulative 100 kg/day target balance. | Verify exact cumulative formula and cycle presentation. |
| C5-03 | [>] Implemented | Previous/Next 10-day navigation must move exactly one adjacent cycle. | Buyer Account and Reports now use one shared cycle helper: `1-10 → 11-20 → 21-end`, including correct previous-month handling from the 1st shift. Awaiting device retest. |
| C5-04 | [ ] | Remove Milk Source Entries from Reports UI only. | Preserve underlying data. |
| C5-05 | [ ] | Add daily total milk table below Animal Profile graph. | Same range and values as graph, plus range total. |
| C5-06 | [ ] | Move Daily Dairy to its own page from a Book icon on Milk. | Preserve its existing functions/data. |
| C5-07 | [ ] | Remove suggestion swipe animation and fix close control for long names. | Apply to animal, buyer, FAT and SNF pickers. |
| C5-08 | [ ] | Remove Today, Buyer Sales and Animal Productivity from Reports UI only. | Preserve data and calculations. |
| C5-09 | [ ] | Keep labels beneath animal names in original label-addition order. | Independent of top Herd tab order. |
| C5-10 | [ ] | Add soft, distinct background shades for app sections. | Visual-only, app-wide consistency work. |
| C5-11 | [ ] | Buyer Account bills upload/history. | Images and PDFs, dated history, open/delete actions. |

## Confirmed scope

- Buyer Account bill uploads accept both images and PDFs.
- Every buyer bill supports open and delete actions.
