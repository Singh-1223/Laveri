# Client Corrections - Round 4 Tracker

Source: `Correction 4_260908_142901.pdf`, received 2026-09-08.

## Status key

- `[ ] Open` - not implemented.
- `[~] Verify/rework` - overlaps earlier work but does not yet meet, or has not been confirmed against, this clarified request.
- `[>] Implemented` - code complete and code-checked; awaiting client retest.
- `[x] Done` - accepted after client retest.
- `[?] Decision needed` - a material business rule is not specified.

**Current summary:** 19 tracked requests: 3 verify/rework items and 16 open items. The app is not changed by this tracker.

## A. Earlier requests restated by the client

| ID | Status | Client request | Current assessment / scope |
|---|---|---|---|
| R4-01 | [~] | Edit a regular buyer's milk rate for an inclusive selected date range and update its historical entries. | Implemented in Round 3 for non-Verka buyers. Retest inclusive start/end dates and report revenue recalculation. Verka remains special cycle billing by the previously confirmed rule. |
| R4-02 | [~] | Upload a bill and compare Morning milk, Evening milk, and Total milk; calculate rate as `(Total Amount - Corpus A/C) / Total milk`. | Implemented in Verka billing only, as previously confirmed by the client. Retest the comparison and calculation flow. |
| R4-03 | [~] | Show Verka cumulative daily balance versus 100 kg/day, with a target that adapts to the active shift length. | Existing Milk indicator uses the 1-10, 11-20, and 21-end-of-month cycle and Verka allocations only. Verify its wording/calculation against this exact daily cumulative example and rework if needed. |

## B. Milk entry

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R4-04 | [ ] | Replace the quantity picker with one horizontally swipeable 3-column x 10-row grid. | Whole-number ranges are columns, 0-9 decimals are rows, selected value highlighted in the middle column; apply to cow, buyer, FAT and SNF inputs. Columns must not scroll independently. |
| R4-05 | [ ] | Make FAT/SNF input colour match milk-entry input styling. | Align entered, selected, empty and disabled visual states. |
| R4-06 | [ ] | Lock Milk Entry by default for past/future dates; keep today editable; allow temporary unlock for a selected past date. | Add a visible header lock control. Inputs must be read-only while locked, retain existing data, and automatically relock after navigating away. |
| R4-07 | [ ] | Allow natural vertical scrolling of Milk Entry from all non-interactive areas. | Resolve nested gesture/scroll behaviour without breaking taps, picker selection, drag/reorder or horizontal picker swipe. |

## C. Reports and animal records

| ID | Status | Client request | Implementation scope |
|---|---|---|---|
| R4-08 | [ ] | Show FAT/SNF records in 10-day shifts with previous/next navigation. | Replace the continuous list only; keep records/calculations unchanged. |
| R4-09 | [ ] | Move Heat Event to each animal profile as **Heat/AI**; remove it from Farm Operation and from general animal History. | Keep all existing Heat fields and behaviour, but list events only for their linked animal under a dedicated profile tab/section. |
| R4-10 | [ ] | Add animal-specific Lactation Records. | Each lactation requires AI date + semen/bull name and calving date + calf name; support successive lactations. |
| R4-11 | [ ] | Show all entered Farm Operation fields clearly in Recent activities. | Include product/item, unit, quantity, rate/amount, comments and relevant operation-specific details. |
| R4-12 | [ ] | Remove Other Events from Farm Operation and add a Reports **Daily Dairy** comment record. | Daily Dairy has one free-text comment with automatic date, monthly previous/current/next navigation, chronological display, and edit/delete. |
| R4-13 | [ ] | Simplify Investment and Silage entries. | Remove suggestions/Add Item and remove unit, quantity and rate. Keep only Date, Comments and Total Amount; retain existing records/data. |
| R4-14 | [ ] | Simplify Treatment entry. | Remove suggestions/Add Item, Product Name, Unit and Quantity. Keep Date, Comments, Doctor Fee and Medical cost. |
| R4-15 | [ ] | Exclude today's milk from all animal milk-history line-graph ranges. | Today remains saved, but appears as a graph point only from the following day. |
| R4-16 | [ ] | Persist calculator history. | Save every calculation separately, including FAT, SNF, CMFAT, CMSNF, all inputs and results; survive app restart. |
| R4-17 | [ ] | Show Reports' Milk Source Entry in 10-day periods. | Keep data/calculations unchanged and add previous/next period navigation. |
| R4-18 | [ ] | Replace animal-profile graph's **7 days** range with **10 days**. | Retain 1 month, 3 months and custom dates. |
| R4-19 | [ ] | Add conception date and live pregnancy duration to an animal profile and Herd card. | Store per animal; show elapsed calendar months/days such as `4M 15D`, update daily, and show nothing when no conception date exists. |

## Dependencies and delivery order

1. **Data model/migrations first:** R4-10 Lactation, R4-12 Daily Dairy, R4-16 Calculator history, R4-19 conception date.
2. **Milk interaction:** R4-04 to R4-07, then R4-03 verification.
3. **Profile and reporting changes:** R4-08 to R4-19.
4. **Retest prior functionality:** R4-01 and R4-02, before release.

## Confirmed prior decisions carried forward

1. Verka billing comparison and bill-rate calculation apply **only to Verka**.
2. Verka target cycles are 1st-10th, 11th-20th and 21st-end-of-month; only milk allocated to Verka counts.
3. Feed, products, treatment and silage are collective production costs, not animal-specific costs.

## Completion rule

Move an item to `[>] Implemented` only after code checks pass. Move it to `[x] Done` only after the client tests the new APK and confirms the behaviour.
