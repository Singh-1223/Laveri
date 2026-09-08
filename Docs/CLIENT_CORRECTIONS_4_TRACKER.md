# Client Corrections - Round 4 Tracker

Source: `Correction 4_260908_142901.pdf`, received 2026-09-08.

## Status key

- `[ ] Open` - not implemented.
- `[~] Verify/rework` - overlaps earlier work but does not yet meet, or has not been confirmed against, this clarified request.
- `[>] Implemented` - code complete and code-checked; awaiting client retest.
- `[x] Done` - accepted after client retest.
- `[?] Decision needed` - a material business rule is not specified.

**Current summary:** 21 tracked requests: 3 verify/rework items, 13 open items, and 5 implemented awaiting device retest.

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
| R4-11 | [>] Implemented | Show all entered Farm Operation fields clearly in Recent activities. | Recent activity now adds quantity, unit and rate for Feed/Product records, Doctor and Medical amounts for Treatment, and retains comments and total amount. Simple Silage/Investment entries retain their concise amount/comment presentation. Awaiting device retest. |
| R4-12 | [ ] | Remove Other Events from Farm Operation and add a Reports **Daily Dairy** comment record. | Daily Dairy has one free-text comment with automatic date, monthly previous/current/next navigation, chronological display, and edit/delete. |
| R4-13 | [>] Implemented | Simplify Investment and Silage entries. | Both forms now remove suggestions/Add Item, unit, quantity and rate. They retain Date, Comment and Total Amount, while historical records remain intact. Requires the simple-entry database migration before device retest. |
| R4-14 | [>] Implemented | Simplify Treatment entry. | Treatment now removes suggestions, Add Item, product name, unit and quantity. It retains animal selection plus Date, Comment, Doctor Fee and Medical cost, without changing existing records. Awaiting device retest. |
| R4-15 | [>] Implemented | Exclude today's milk from all animal milk-history line-graph ranges. | All preset and custom graph ranges now end at yesterday. Today's saved Milk data appears as a point only the next day. Awaiting device retest. |
| R4-16 | [ ] | Persist calculator history. | Save every calculation separately, including FAT, SNF, CMFAT, CMSNF, all inputs and results; survive app restart. |
| R4-17 | [ ] | Show Reports' Milk Source Entry in 10-day periods. | Keep data/calculations unchanged and add previous/next period navigation. |
| R4-18 | [>] Implemented | Replace animal-profile graph's **7 days** range with **10 days**. | Presets are now 10 days, 1 month and 3 months; custom dates remain available. Awaiting device retest. |
| R4-19 | [ ] | Add conception date and live pregnancy duration to an animal profile and Herd card. | Store per animal; show elapsed calendar months/days such as `4M 15D`, update daily, and show nothing when no conception date exists. |
| R4-20 | [ ] | Export/share an individual buyer's 10-day milk report for external bill comparison. | Generate a buyer-specific CSV with date, Morning litres, Evening litres, Total litres and period totals. The user shares it with the bill PDF/image to an external tool such as ChatGPT for comparison. |
| R4-21 | [>] Implemented | Show non-profile animal attachments only in History, not in a separate attachment gallery. | The separate gallery is removed. Dated History now shows a small image thumbnail or PDF link, retains delete/open actions, and uses light separators. Profile-picture handling remains separate. Awaiting device retest. |

## Dependencies and delivery order

1. **Data model/migrations first:** R4-10 Lactation, R4-12 Daily Dairy, R4-16 Calculator history, R4-19 conception date.
2. **Milk interaction:** R4-04 to R4-07, then R4-03 verification.
3. **Profile and reporting changes:** R4-08 to R4-19.
4. **Buyer export and attachment presentation:** R4-20 to R4-21.
5. **Retest prior functionality:** R4-01 and R4-02, before release.

## Confirmed prior decisions carried forward

1. Verka billing comparison and bill-rate calculation apply **only to Verka**.
2. Verka target cycles are 1st-10th, 11th-20th and 21st-end-of-month; only milk allocated to Verka counts.
3. Feed, products, treatment and silage are collective production costs, not animal-specific costs.
4. For regular buyers, bill comparison is performed externally: export/share the buyer's 10-day CSV report and attach it together with the bill image/PDF in a tool such as ChatGPT. Do not add regular-buyer bill upload, OCR or manual bill-entry fields. Keep the existing special Verka billing flow unchanged.

## Completion rule

Move an item to `[>] Implemented` only after code checks pass. Move it to `[x] Done` only after the client tests the new APK and confirms the behaviour.
