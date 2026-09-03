# Laveri — Client Testing Guide

Welcome to Laveri. This app helps record daily dairy work: animals, milk, milk sales, feed, treatment, other costs, and heat events. It works offline after the first online sign-in, then synchronizes data when internet returns.

Please use this guide with **test data first**. Do not enter important real farm records until the testing is complete.

## 1. Before you start

1. Install the APK sent to you and open **Laveri**.
2. Keep internet on for the first sign-in.
3. Tap **Continue with Google** and use the Google account chosen for this farm.
4. If this is the first-ever use of that Google account, enter the farm name and tap **Create farm**.
5. If the farm was already created, wait briefly for **Loading your farm**. Your records should appear automatically.

> Important: Use the **same Google account** on every phone that should see the same farm data.

## 2. Main screens at a glance

| Screen | What it is for |
|---|---|
| Home | Today’s dairy summary, farm setup, pricing, correction history, and sign-out. |
| Milk | Morning/evening cow milk entries, buyer sales, household milk, and milk pricing. |
| Herd | View and search animals already added to the farm. |
| Expenses / Farm operations | Record Feed, Treatment/Medicine, Products/Costs, and Heat events. |
| Reports | Check totals for any date range and export an Excel-compatible CSV file. |
| Master data | Create and maintain animals, buyers, feed items, medicines, and products. |
| Milk pricing | Configure the milk price used for entries. |
| Correction history | Review edits, deactivations, and voided records. |
| Sync status | Check if records have synchronized and see pending uploads/errors. |

## 3. Recommended first-time setup

Do these steps in order.

### Step 1 — Add master data

Open **Home → Manage master data**.

Master data means reusable information you set up once and select later instead of typing it repeatedly.

#### Animals

Add every animal that may be recorded in the app.

1. Select **Animals**.
2. Choose the animal type: **Cow**, **Heifer**, or **Calf**.
3. Select **Milking** only for an animal currently producing milk.
4. Enter the tag/name and optional breed.
5. Tap **Save animal**.

Only active, milking animals appear in the Milk entry screen. If an animal stops producing, use **Deactivate** instead of deleting it; past records remain safe.

#### Buyers

Add every person/company that buys milk.

1. Select **Buyers**.
2. Enter name and optional phone number.
3. Tap **Save buyer**.

The Milk screen automatically creates one sales row for each active buyer. The app also includes **Household consumption** for milk used at home.

#### Feed, medicine, and products

Add common reusable items.

- **Feed:** for example, green fodder, dry fodder, cattle feed.
- **Medicine:** for example, calcium, antibiotic, vaccine.
- **Product:** farm supplies or other costs, such as cleaning supplies or equipment.

Enter an item name and its normal unit, such as `kg`, `bag`, `ml`, or `unit`.

### Step 2 — Set milk pricing

Open **Home → Configure milk pricing**.

Choose one pricing mode:

- **Flat rate:** one price per litre, for example ₹50/L.
- **FAT + SNF quality rate:** enter CMFAT and CMSNF values. On every milk session, enter FAT% and SNF%; the app calculates the rate automatically.

Choose the effective date from the calendar and save. The price used is stored with each milk record, so later price changes do not alter old records.

## 4. Daily use: Milk entry

Open the **Milk** tab.

### Milk reminders

From the Milk screen, tap **Configure milk reminders**. Turn on Morning and/or Evening, choose the time, and tap **Save reminders**. Allow notifications when Android asks. These reminders belong to that phone only; completing a milk session moves its reminder to the next day.

### Verka billing

In **Master data → Buyers**, tap **Verka**. Choose the 10-day period, enter its final per-litre rate and any commission, increment, or deduction. You may attach an invoice PDF/image (maximum 10 MB), then save the billing cycle. The saved cycle can open its attached bill later.

1. Check the date at the top. Use `‹` and `›` for the previous/next day, or **Go to today**.
2. Select **Morning** or **Evening**.
3. Enter litres for each animal. Leave an animal blank only when no entry should be recorded for that session.
4. Enter the quantities sold to each buyer.
5. Enter milk used at home in **Household consumption**.
6. Check **Produced** and **Remaining**. Remaining is milk not yet allocated. The app does not allow allocation greater than production.
7. Tap **Save morning session** or **Save evening session**.

For quality pricing, enter FAT% and SNF% before saving. The calculated rate per litre is shown on screen.

### Correcting milk

If a saved value is wrong, open the same date and session, change the value, and save again.

If the whole morning/evening session should not count, use **Void entire session**, write a reason, confirm it, then enter the correct replacement session. Do not delete records.

## 5. Farm operations: Feed, medicine, costs, and heat

Open the **Expenses** tab (its screen heading is **Farm operations**) and choose the required tab at the top.

### Feed

Use for feed purchased or used for the farm. Select the date from the calendar, feed item, quantity, rate, and optional comment. The app calculates the total.

### Treatment

Use for doctor/veterinary visits and medicine costs. Select one or more animals, optional medicine, doctor fee, medicine cost, date from the calendar, and comment. The total includes doctor fee plus medicine cost.

### Product

Use for other farm spending. Select the product, quantity, rate, and whether it is:

- **Operating:** regular running cost; included in operating profit.
- **Investment:** a longer-term purchase; shown separately from operating cost.

### Heat

Use to record that an animal was observed in heat. Select the animal, date from the calendar, and observed signs/note.

Every operation can be edited later. If it should not count, use **Void record** with a reason rather than deleting it.

## 6. Herd

Open the **Herd** tab to view the animals you have added.

- Search by animal tag/name or breed.
- Filter by All, Cows, Heifers, or Calves.
- Use **Add or manage animals** to return to Master data for changes.

## 7. Home dashboard

Open **Home** to check today’s summary:

- Today’s milk produced
- Unallocated milk
- Turnover (milk sale revenue)
- Operating cost
- Operating profit
- Investment

Use this screen to open Master data, milk pricing, correction history, or Sync status.

## 8. Reports and CSV export

Open the **Reports** tab.

1. Choose a **From date** and **To date** from the calendars.
2. Tap **Refresh report**.
3. Review production, revenue, operating cost, profit, household milk, and investment.
4. Review milk source entries, buyer sales, cost breakdown, and animal productivity.
5. Use the filters to view one animal or buyer.
6. To save a file, tap **Choose folder and export CSV**, select a phone folder, then open the CSV in Excel or Google Sheets.

## 9. Sync status and offline use

Open **Sync status** from the status pill in the app header or through Home.

- **Green / zero pending uploads:** records are synchronized.
- **Amber / pending uploads:** records are safely saved on the phone and will upload when internet returns.
- **Red / error:** open Sync status, take a screenshot, and report the exact error.

### Test offline use

1. While online, wait until pending uploads are `0`.
2. Turn on airplane mode.
3. Add one milk entry or one operation.
4. Confirm it appears immediately.
5. Close and reopen the app while still offline; confirm the record remains.
6. Restore internet and wait until pending uploads return to `0`.

## 10. Test on a second phone

1. Install the same APK on another Android phone.
2. Sign in using the **same Google account**.
3. Wait for the first download to complete.
4. Add a test record on phone A while online.
5. Confirm it appears on phone B.
6. Add a different test record on phone B and confirm it appears on phone A.

## 11. Complete testing checklist

Please mark each item Pass or Fail.

### A. Sign-in and setup

- [ ] App installs and opens without a developer computer.
- [ ] Google sign-in returns to Laveri.
- [ ] Existing farm appears after signing in again.
- [ ] Same Google account shows the same farm on a second phone.

### B. Master data and herd

- [ ] Add Cow, Heifer, and Calf; the selected animal type stays visible and highlighted.
- [ ] Add buyers, feed, medicine, and product items.
- [ ] Edit an animal and confirm the change appears in Herd.
- [ ] Deactivate and reactivate an item/animal without losing its old records.

### C. Milk

- [ ] Enter morning and evening milk for at least two animals.
- [ ] Allocate milk to at least one buyer and Household consumption.
- [ ] Check that allocation cannot be greater than produced milk.
- [ ] Save, edit, void, and replace a milk session.
- [ ] Test flat pricing and FAT + SNF pricing, if both are used by the farm.

### D. Operations

- [ ] Add and edit one Feed record.
- [ ] Add and edit one Treatment record.
- [ ] Add and edit one Product/Cost record.
- [ ] Add one Heat event.
- [ ] Void one test operation with a reason and confirm it no longer counts in totals.

### E. Dashboard and reports

- [ ] Home values match the test records entered today.
- [ ] Report values match the selected date range.
- [ ] Buyer sales and animal filters work.
- [ ] CSV export opens correctly in Excel or Google Sheets.

### F. Offline and two-phone sync

- [ ] Offline record remains after closing/reopening the app.
- [ ] Offline record uploads after internet returns.
- [ ] Records entered on one phone appear on the second phone.

## 12. How to report a problem

For every issue, send this information with a screenshot or short screen recording:

```text
Screen name:
What I was trying to do:
Steps taken:
Expected result:
What actually happened:
Date/time:
Phone model and Android version:
Internet state: Wi-Fi / mobile data / offline:
Sync Status message, if any:
```

Do not uninstall the app or sign out before checking **Sync status** and confirming pending uploads are `0`, unless instructed by the developer.
