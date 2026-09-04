# Client Corrections — Round 2 Tracker

Source: `App correction 2_260904_140954.pdf`, received 2026-09-04.

## Status key

- `[ ] Open` — not implemented yet.
- `[~] Reopened` — related work exists, but the client reports it does not meet the requirement.
- `[>] Implemented` — code complete and code-checked; awaiting client retest.
- `[x] Done` — implemented and accepted after client retest.
- `[?] Decision needed` — conflicts with an earlier decision or needs a business-rule choice.

**Current summary:** 24 open/reopened tasks, 2 decisions needed, 1 confirmed working item. No item is marked done until the client retests it.

## Confirmed working

| ID | Status | Request | Notes |
|---|---|---|---|
| R2-24 | [x] Done | Heat Event | Client marked Heat Event as “all set.” No change planned unless a later regression is reported. |

## A. Navigation and reports

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-01 | [ ] Open | Remove the separate Home page and treat Milk entry as the app home page. | Start on Milk; remove the Home tab/screen from normal navigation. |
| R2-02 | [ ] Open | Move today’s milk, unallocated/household milk, turnover, operating cost, operating profit, and investment to Reports. | Consolidate these dashboard figures into Reports. Investment is subject to R2-26. |
| R2-03 | [ ] Open | Add a three-dot button on Milk that opens a slide-out menu with Master data, Price calculator, Correction history, and Milk reminder settings. | Create a compact Milk-page menu/drawer and move these utilities there. |
| R2-04 | [ ] Open | Replace “Configure milk pricing” with a Price calculator. | Calculator inputs: CMFAT coefficient, SMFAT coefficient, FAT%, SNF%, then calculated price. This is a calculator only, not the fixed buyer-rate configuration. |

## B. Milk entry usability and layout

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-05 | [~] Reopened | The keyboard still hides most of the current entry. | Ensure the selected Milk field scrolls sufficiently above the keyboard on real Android devices. |
| R2-06 | [ ] Open | Allow a separate, editable cow order for Milk entry. | Provide Move up/Move down in Milk; do not reuse Herd order for this list. |
| R2-07 | [ ] Open | Mark the current date as “Today”; other dates already show Go to today. | Add a clear Today label/action in the date navigator. |
| R2-08 | [ ] Open | Remove Milk-page clutter. | Remove the auto-save sentence, the reminder button, and the section headings “Animals”, “Daily milk quality (reference only)”, and “Buyer allocation”. |
| R2-09 | [ ] Open | Keep only FAT% and SNF% fields; remove Daily milk quality heading/details. | Preserve fields and saving behaviour while reducing vertical space. |
| R2-10 | [ ] Open | Show coloured animal labels below each animal name in Milk, in a maximum of two lines. Remove “Missing entry”/“Saved” text. | Reuse Herd label chips with compact two-line layout. |
| R2-11 | [ ] Open | Replace numeric keyboard entry with a scrollable suggestion picker. | Milk: 0.0–30.0 in 0.1 steps (301 values). FAT/SNF: 0.0–10.0 in 0.1 steps (101 values). Pre-fill from previous day in light text; open centered on that previous value; selecting a value moves automatically to the next field. |

## C. Master data

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-12 | [ ] Open | Remove Cow, Heifer, and Calf categories from Add animal. | Treat every record simply as an animal; lifecycle is represented only by editable coloured labels. |
| R2-13 | [~] Reopened | Saved custom labels cannot be edited/deleted and overflow horizontally. | Add edit/delete actions and wrap label chips onto additional lines. |
| R2-14 | [ ] Open | Add more label colours. | Include white, black, pink, yellow, sky blue, and brown, with accessible text/border contrast. |
| R2-15 | [~] Reopened | Add animal profile picture, date of birth, and optional date of purchase. | Ensure a primary image can be selected and displayed before the animal name; capture both dates. |
| R2-16 | [~] Reopened | A Verka buyer with no fixed rate shows “Set rate in master data.” | Make the Verka card clearly use billing-cycle pricing and avoid the fixed-rate warning. |
| R2-17 | [~] Reopened | Verka billing needs prior-cycle rate handling, bill upload, and bill-vs-app tally. | Verify/complete the special billing input, retained provisional rate, uploaded bill, and displayed difference. Client sample bill is the implementation reference. |
| R2-18 | [ ] Open | Feed, Medicine, and Product masters should use Delete instead of Activate/Deactivate. | Replace deactivate UI with safe delete/archive behaviour that preserves historical records. |
| R2-19 | [ ] Open | Improve master fields for Feed, Medicine, and Product. | Rename Base unit to Packaging (kg or kg/ml as applicable); Feed also gets fixed price; Medicine/Product show a visible use/comment. |

## D. Farm operations

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R2-20 | [ ] Open | Simplify Feed entry and its suggestions. | Automatically save a new feed to Master data; remove “add and save for future suggestions”; use Packaging (kg), Units (number of bags), remove Feed comment, allow deleting suggestions, and make a tapped suggestion populate the form. |
| R2-21 | [ ] Open | Simplify Treatment entry and its suggestions. | Automatically save a new medicine to Master data; remove the explicit future-suggestion control; allow deleting suggestions; make a tapped suggestion populate the form. |
| R2-22 | [ ] Open | Simplify Product entry and its suggestions. | Automatically save a new product to Master data; use Packaging and Units; allow deleting suggestions; make a tapped suggestion populate the form. |
| R2-23 | [ ] Open | Add Silage. | New farm-wide Silage operation with the same workflow and data fields as Product. |
| R2-25 | [ ] Open | Animal history is incorrect/incomplete. | Use the original animal photo instead of emoji; exclude Milk records from history; include Heat events; include Treatment details and comments. |

## E. Decision needed

| ID | Status | Question | Why it needs confirmation |
|---|---|---|---|
| R2-26 | [?] Decision needed | Should Investment now be a real operation and reporting category, with the same flow as Product? | The prior confirmed rule said Feed, Product, Medicine, and Treatment are all production costs and that Investment was not needed. This PDF asks for an Investment option and lists Investment on Reports. |
| R2-27 | [?] Decision needed | What exactly should the Verka bill tally compare? | The sample bill contains milk quantity/FAT/SNF figures, per-kg amounts, commission, deductions, adjustments, and net amount. We need the required fields and formula for a correct “difference” result, rather than comparing only a final rate. |

## Suggested delivery order

1. Navigation and Milk layout: R2-01 to R2-10.
2. Milk suggestion picker: R2-11 (largest interaction change; test after the surrounding layout is stable).
3. Master data and operation workflows: R2-12 to R2-23.
4. Herd profile/history: R2-15 and R2-25.
5. Verka: R2-16 and R2-17 after R2-27 is answered.
6. Investment/reporting: R2-02 and R2-26 after confirmation.

## Completion rule

Move an item to `[>] Implemented` only after code checks pass. Move it to `[x] Done` only after the client tests the new APK and confirms the behaviour.
