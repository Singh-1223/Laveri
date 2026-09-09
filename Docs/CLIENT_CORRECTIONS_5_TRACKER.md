# Client Corrections - Round 5 Tracker

Source: `Correction 5_260909_113806.pdf`, received 2026-09-09.

## Status key

- `[ ] Open` - not implemented.
- `[~] Verify/rework` - overlaps existing work but needs confirmation or adjustment.
- `[>] Implemented` - code complete and awaiting device retest.
- `[x] Done` - accepted after client retest.

| ID | Status | Client request | Scope |
|---|---|---|---|
| C5-01 | [>] Verified | Apply regular buyer rate changes to inclusive historical date ranges. | Existing Master Data buyer editor applies the entered rate to that buyer’s saved allocations from the selected start date through end date, inclusive. Awaiting device retest. |
| C5-02 | [>] Verified | Verka cumulative 100 kg/day target balance. | Milk calculates only saved Verka allocations from the current cycle start to the selected date and compares them with elapsed days × 100 kg. Awaiting device retest. |
| C5-03 | [>] Implemented | Previous/Next 10-day navigation must move exactly one adjacent cycle. | Buyer Account and Reports now use one shared cycle helper: `1-10 → 11-20 → 21-end`, including correct previous-month handling from the 1st shift. Awaiting device retest. |
| C5-04 | [>] Implemented | Remove Milk Source Entries from Reports UI only. | Milk Source Entries, navigation and filters are removed from Reports. Source data and repository logic are preserved. Awaiting device retest. |
| C5-05 | [>] Implemented | Add daily total milk table below Animal Profile graph. | The table is directly below the unchanged graph and uses the same displayed daily points/date range. It has one combined morning/evening total per day and a Total milk row. Awaiting device retest. |
| C5-06 | [>] | Move Daily Dairy to its own page from a Book icon on Milk. | Implemented; preserve its existing functions/data. |
| C5-07 | [>] Implemented | Remove suggestion swipe animation and fix close control for long names. | Suggestions now change range immediately through Previous/Next controls; selection still advances automatically, and the persistent Close control remains visible for long names. Awaiting device retest. |
| C5-08 | [>] Implemented | Remove Today, Buyer Sales and Animal Productivity from Reports UI only. | These three sections are removed from the Reports screen only. Stored transactions and report calculations remain unchanged. Awaiting device retest. |
| C5-09 | [>] Implemented | Keep labels beneath animal names in original label-addition order. | Labels beneath each animal now sort by immutable custom-label creation time. Dragging top Herd tabs does not change this displayed order. Awaiting device retest. |
| C5-10 | [>] Implemented | Add soft, distinct background shades for app sections. | Section cards now receive consistent, soft complementary shades from their title, in both light and dark themes. Awaiting device retest. |
| C5-11 | [>] Implemented | Buyer Account bills upload/history. | Images and PDFs can be attached to the selected 10-day period; each entry has open and delete actions. Requires the new Supabase migration and PowerSync deployment before device retest. |

## Confirmed scope

- Buyer Account bill uploads accept both images and PDFs.
- Every buyer bill supports open and delete actions.
