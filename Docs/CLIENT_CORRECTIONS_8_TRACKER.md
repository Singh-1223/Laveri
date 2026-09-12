# Client Corrections - Round 8 Tracker

Source: `Correction 8_260912_120805.pdf`, received 2026-09-12.

## Status key

- `[ ] Open` - not implemented.
- `[~] Verify/rework` - overlaps existing work and needs confirmation or adjustment.
- `[>] Implemented` - code complete and awaiting device retest.
- `[x] Done` - accepted after client retest.

## Work items

| ID | Status | Client request | Scope and acceptance criteria |
|---|---|---|---|
| C8-01 | [>] Implemented | Improve the Verka milk suggestion grid. | Keeps the existing Verka-only 1 L increment, renders whole litres without a trailing `.0`, and arranges each 10-row range vertically by column: `1/11/21` through `10/20/30`. A swipe advances one displayed 10-value column: 10 L for Verka and 5 L for normal buyers using 0.5 L steps. Milk Entry also removes trailing `.0` from every whole-number suggestion, selected value, and previous-value placeholder; fractions remain unchanged. Awaiting device retest. |
| C8-02 | [>] Implemented | Keep Milk Entry label chips in the same order as Herd. | Milk Entry now uses Herd's label creation/display order for each animal. Awaiting device retest. |
| C8-03 | [>] Implemented | Compact the FAT and SNF area without changing its behavior. | Removes the card heading, retains the `FAT %` and `SNF %` labels, and places half-width inputs compactly side-by-side. Calculations and picker flow are unchanged. Awaiting device retest. |
| C8-04 | [>] Implemented | Simplify Reports FAT/SNF record rows. | Shows a single table-style header: `Date & Time | FAT % | SNF %`, followed by value-only rows. Source data and navigation are unchanged. Awaiting device retest. |
| C8-05 | [>] Implemented | Show app information in the Milk three-dots menu. | Adds display-only Login ID, Farm Name, and App Version above the existing menu actions. Theme and sign-out remain available. Awaiting device retest. |
| C8-06 | [>] Implemented | Add pull-to-refresh with cloud synchronization. | Pulling down on each main page reconnects PowerSync without clearing offline data, reloads that page's local data, and displays the native refresh indicator while it runs. Refresh is armed only when a new drag starts at the top, preventing a normal upward scroll from accidentally triggering it. The visible indicator has a 10-second fail-safe, so it cannot remain stuck during a slow/canceled network refresh. Awaiting device retest online and offline. |
| C8-07 | [>] Implemented | Allow horizontal swiping across the main pages. | A clearly horizontal swipe moves through Milk, Herd, Farm Operation, and Reports in order. It is disabled while the Milk suggestion picker, side drawer, or date calendar is open, and while Milk rows or Herd labels are actively being reordered. Bottom navigation remains available. Awaiting device retest. |
| C8-08 | [>] Implemented | Remove two subtitle lines. | Removes the specified Farm Operation and Reports subtitle lines only. Awaiting device retest. |
| C8-09 | [>] Implemented | Open Buyer Entry suggestions after SNF selection. | Selecting SNF now immediately opens the first Buyer Entry suggestion picker; FAT-to-SNF flow and buyer auto-advance are preserved. Awaiting device retest. |

## Recommended implementation order

1. Complete isolated Milk and Reports UI work: C8-01, C8-02, C8-03, C8-04, C8-08, C8-09.
2. Add the menu information panel for C8-05.
3. Implement C8-06 pull-to-refresh against the PowerSync lifecycle.
4. Implement C8-07 last, because horizontal navigation must coexist with scrolling, pickers, and the existing row drag-and-drop gestures.

## Device validation focus

- Test Verka and regular-buyer pickers separately, including range swipes and automatic next-field behavior.
- Verify label order after editing/reordering labels in Herd.
- Verify a refresh on every main page while online and offline.
- Verify page swipes do not accidentally trigger while dragging an animal/buyer row or swiping a suggestion grid.
