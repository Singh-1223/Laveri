# Client Corrections — Round 2 Tracker

Source: `App correction 2_260904_140954.pdf`, received 2026-09-04.

## Status key

- `[ ] Open` — not implemented yet.
- `[~] Reopened` — related work exists, but the client reports it does not meet the requirement.
- `[>] Implemented` — code complete and code-checked; awaiting client retest.
- `[x] Done` — implemented and accepted after client retest.
- `[?] Decision needed` — conflicts with an earlier decision or needs a business-rule choice.

**Current summary:** 8 open/reopened tasks, 17 implemented awaiting retest, 0 decisions needed, 1 confirmed working item. No item is marked done until the client retests it.

## Confirmed client decisions — 2026-09-04

1. **Investment** is a real, separate farm operation and reporting category. It is the only entry type not treated as a production cost.
2. Investment entry has the same data-entry workflow and fields as Product. Reports show total investment in rupees.
3. **Silage** is a separate farm operation with the same workflow and fields as Product, but it is included in production cost.
4. The Verka bill tally compares only Morning milk, Evening milk, and Total milk. It does not compare FAT/SNF, commission, deductions, adjustments, or final payable amount.

## Confirmed working

| ID | Status | Request | Notes |
|---|---|---|---|
| R2-24 | [x] Done | Heat Event | Client marked Heat Event as “all set.” No change planned unless a later regression is reported. |

## A. Navigation and reports

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-01 | [>] Implemented | Remove the separate Home page and treat Milk entry as the app home page. | The Home tab is hidden. The former Home route remains only as the first-run farm-setup gate; existing farms are immediately redirected to Milk. Awaiting client retest. |
| R2-02 | [>] Implemented | Move today’s milk, unallocated/household milk, turnover, operating cost, operating profit, and investment to Reports. | Reports now has a Today summary for milk, household milk, turnover, operating cost, operating profit, and Investment, in addition to the selected date-range report. Awaiting client retest. |
| R2-03 | [>] Implemented | Add a three-dot button on Milk that opens a slide-out menu with Master data, Price calculator, Correction history, and Milk reminder settings. | Milk now has a three-dot slide-out menu with all four utilities. Awaiting client retest. |
| R2-04 | [>] Implemented | Replace “Configure milk pricing” with a Price calculator. | The former farm-wide pricing configuration screen is now a non-persistent Price calculator with CMFAT, SMFAT, FAT%, SNF%, and the calculated per-litre price. Buyer rates remain separate. Awaiting client retest. |

## B. Milk entry usability and layout

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-05 | [>] Implemented | The keyboard still hides most of the current entry. | Milk numeric fields now use the in-app suggestion picker instead of the Android keyboard, so the selected value is always visible. Awaiting client retest. |
| R2-06 | [>] Implemented | Allow a separate, editable cow order for Milk entry. | Milk now has independent up/down controls for every active milking animal. The order is separate from Herd order. Migration `202609040001_milk_display_order.sql` must be pushed with the final Round 2 migrations before retest. |
| R2-07 | [>] Implemented | Mark the current date as “Today”; other dates already show Go to today. | The current selected farm date now visibly reads Today; other dates retain Go to today. Awaiting client retest. |
| R2-08 | [>] Implemented | Remove Milk-page clutter. | Removed the auto-save sentence, Milk-page reminder button, and Animals/Daily milk quality/Buyer allocation headings. Reminder settings are in the Milk menu. Awaiting client retest. |
| R2-09 | [>] Implemented | Keep only FAT% and SNF% fields; remove Daily milk quality heading/details. | FAT% and SNF% fields remain, while the Daily milk quality heading and explanatory text are removed. Awaiting client retest. |
| R2-10 | [>] Implemented | Show coloured animal labels below each animal name in Milk, in a maximum of two lines. Remove “Missing entry”/“Saved” text. | Milk now uses compact coloured label chips below each animal name, clipped to two lines. Saved/Missing entry text is removed. Awaiting client retest. |
| R2-11 | [>] Implemented | Replace numeric keyboard entry with a scrollable suggestion picker. | Milk and buyer fields use 0.0–30.0 (301 values); FAT/SNF use 0.0–10.0 (101 values). Previous values appear in light text, each picker opens at that previous value, and animal selection advances automatically to the next animal, FAT, then SNF. Awaiting client retest. |

## C. Master data

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-12 | [>] Implemented | Remove Cow, Heifer, and Calf categories from Add animal. | Add/Edit animal no longer presents Cow, Heifer, or Calf choices. All records use custom lifecycle labels; the legacy internal category remains Cow for compatibility with existing data. Awaiting client retest. |
| R2-13 | [>] Implemented | Saved custom labels cannot be edited/deleted and overflow horizontally. | Custom label chips wrap within the screen. A label-management list now provides Edit and Delete controls; deletion hides the label without removing historical records. Awaiting client retest. |
| R2-14 | [>] Implemented | Add more label colours. | Added white, black, pink, yellow, sky blue, and brown. Selected label text automatically switches between dark and light contrast. Awaiting client retest. |
| R2-15 | [~] Reopened | Add animal profile picture, date of birth, and optional date of purchase. | Date of birth and optional date of purchase are now captured and saved in Add/Edit animal. Primary photo selection/display remains to be completed. |
| R2-16 | [>] Implemented | A Verka buyer with no fixed rate shows “Set rate in master data.” | Verka now displays “Billing-cycle rate” in Master data, while other buyers still show their fixed rate or Rate not set. Awaiting client retest. |
| R2-17 | [~] Reopened | Verka billing needs prior-cycle rate handling, bill upload, and bill-vs-app tally. | Verify/complete the special billing input, retained provisional rate, uploaded bill, and a bill-vs-app comparison for Morning milk, Evening milk, and Total milk only. |
| R2-18 | [>] Implemented | Feed, Medicine, and Product masters should use Delete instead of Activate/Deactivate. | Feed, Medicine, and Product now use Delete. The saved item is soft-deleted, so it disappears from future choices while historical transactions remain intact. Awaiting client retest. |
| R2-19 | [~] Reopened | Improve master fields for Feed, Medicine, and Product. | Master data now calls Base unit “Packaging” and supports an optional fixed Feed package price. The visible Medicine/Product use-comment remains to be added with the operation suggestion redesign. |

## D. Farm operations

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-20 | [ ] Open | Simplify Feed entry and its suggestions. | Automatically save a new feed to Master data; remove “add and save for future suggestions”; use Packaging (kg), Units (number of bags), remove Feed comment, allow deleting suggestions, and make a tapped suggestion populate the form. |
| R2-21 | [ ] Open | Simplify Treatment entry and its suggestions. | Automatically save a new medicine to Master data; remove the explicit future-suggestion control; allow deleting suggestions; make a tapped suggestion populate the form. |
| R2-22 | [ ] Open | Simplify Product entry and its suggestions. | Automatically save a new product to Master data; use Packaging and Units; allow deleting suggestions; make a tapped suggestion populate the form. |
| R2-23 | [ ] Open | Add Silage. | New farm-wide Silage operation with the same workflow and data fields as Product. It is included in production cost. |
| R2-26 | [ ] Open | Add Investment. | New farm-wide Investment operation with the same workflow and data fields as Product. It is tracked separately from production cost, and Reports show the total investment in rupees. |
| R2-25 | [>] Implemented | Animal history is incorrect/incomplete. | Animal history now excludes Milk entries and includes lifecycle events, Heat events, and Treatment amounts/comments. Photo/document uploads remain available. Awaiting client retest. |

## Suggested delivery order

1. Navigation and Milk layout: R2-01 to R2-10.
2. Milk suggestion picker: R2-11 (largest interaction change; test after the surrounding layout is stable).
3. Master data and operation workflows: R2-12 to R2-23, then R2-26.
4. Herd profile/history: R2-15 and R2-25.
5. Verka: R2-16 and R2-17.
6. Reports: R2-02 after the Investment operation exists.

## Completion rule

Move an item to `[>] Implemented` only after code checks pass. Move it to `[x] Done` only after the client tests the new APK and confirms the behaviour.
