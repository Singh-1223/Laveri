# Laveri Release Build and Pilot Testing Guide

Use this guide when sharing Laveri with family testers. The recommended method is an Expo Application Services (EAS) internal-distribution APK: Expo builds and signs it in the cloud, then provides a download link. Testers should use only test records until every release-blocking check passes.

## 1. Choose the build type

Use an **APK** to send the app directly to family testers. It can be installed from a file or download link on their Android phone.

An **AAB** is not needed for this project. It is for Google Play Console and cannot be installed directly on a phone.

For the family pilot, create only an EAS preview APK.

## 2. One-time EAS setup

Run these commands from the project folder. Sign in with the Expo account that should own the Laveri builds.

```bash
cd /Users/lovepreet.singh/Desktop/code/projects/extensions/laveri
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

During the first build, EAS will ask about Android signing credentials. Choose **Generate new keystore**. EAS stores it securely and automatically reuses the same signing identity for future APK updates, so Android can install an update over the previous Laveri app.

`eas.json` already contains the `preview` profile needed to create an installable APK.
It also lets EAS increase the Android build number for each later preview build, which is required for reliable in-place app updates.

### Configure public build environment values

EAS cloud builders do not use your local ignored `.env` file. In Expo Dashboard, open the Laveri project and add these **Environment variables** for the `preview` environment:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_POWERSYNC_URL
```

Copy the values from your local `.env`. These are public mobile-app configuration values; do not add a Supabase service-role key, Google Client Secret, database password, or PowerSync replication password.

## 3. Pre-build checklist

Before every tester build:

1. Confirm `.env` contains the production/pilot Supabase and PowerSync public URLs and keys.
2. Confirm Google sign-in and PowerSync are configured for that same Supabase project.
3. Confirm EAS `preview` environment variables are set to the intended pilot Supabase and PowerSync project.
4. Run:

   ```bash
   npm run verify
   git diff --check
   ```

5. Do not include service-role keys, database passwords, Google client secrets, or PowerSync database credentials in the app or `.env`.

## 4. Create an APK for direct tester installation

From the project root:

```bash
npx eas-cli@latest build --platform android --profile preview
```

EAS will queue a cloud build and print a build-details link. When it finishes, open that link, download the APK, or send its download link to each tester. On their Android phone:

1. Download or receive the APK.
2. Open it in the Files app.
3. If Android asks, allow that app to install unknown apps.
4. Tap **Install**, then open Laveri.
5. Do not uninstall the previous Laveri app before an update. Installing the next EAS preview APK over it preserves its local offline database. If Android says the signatures differ, stop and ask the developer—do not uninstall until all pending records have synchronized.

## 5. Tester instructions before starting

Each tester should record:

```text
Tester name:
Phone model and Android version:
Laveri app version:
Google account used:
Date and time:
Internet type: Wi-Fi / mobile data / offline
```

Use one Google account for all devices that should share the same farm. Do not test simultaneous work with different accounts unless specifically checking data isolation.

After every online save, open **Sync status** and wait until pending uploads are zero before moving to a different test or uninstalling the app.

## 6. Pilot test checklist

Mark every result as Pass, Fail, or Not tested. On failure, capture a screenshot and use the report template in section 7.

### Test 1 — Install and first open

1. Install the APK.
2. Open the app without a developer computer or Metro running.
3. Confirm the sign-in screen is visible and the app does not show a blank screen, development-server error, or unmatched route.
4. Close and reopen the app once.

Expected: the installed APK works independently of the development computer.

### Test 2 — Google sign-in and session persistence

1. Connect to the internet and choose **Continue with Google**.
2. Select the intended Google account and complete the browser flow.
3. Confirm that the app returns to Laveri, not an Unmatched Route screen.
4. Force-close and reopen Laveri.
5. Confirm the same account remains signed in.
6. Sign out and sign in again with the same account.

Expected: sign-in works, returns to the app, and the correct farm data returns after re-sign-in.

### Test 3 — Master data

1. Add at least two cows with distinct tags/names and valid details.
2. Add at least two buyers and required items/categories.
3. Edit one cow and verify the changed details appear in Herd and relevant entry forms.
4. Deactivate a cow, buyer, and item. Confirm historical records remain visible but inactive values are unavailable for new entries.
5. Reactivate them and confirm they can be selected again.

Expected: no duplicate, missing, or incorrect master data; historical entries keep their original values.

### Test 4 — Milk, allocation, and pricing

1. Configure a flat milk price effective today.
2. Add morning and evening milk for both cows on the same day.
3. Allocate milk to two buyers and household use. Include one intentionally unallocated amount.
4. Verify produced litres, allocations, unallocated litres, rate, and amount on Milk, Home, and Reports.
5. Correct one saved session; verify totals change only once.
6. Void one saved session with a reason, then create a replacement session.
7. Configure FAT + SNF pricing and verify a known calculation. With CMFAT `600`, CMSNF `200`, FAT `4.25`, and SNF `8.50`, expected rate is ₹42.50/L.

Expected: totals reconcile with the entered values and voided values are not included in active totals.

### Test 5 — Costs and operations

1. Create one feed transaction, treatment, product/operating expense, investment, and heat event.
2. Check dates, linked cows/items, quantities, rates, amounts, notes, and categories.
3. Edit each record and verify the updated cost/report value appears once.
4. Void a record with a reason and confirm the active totals decrease while correction history remains.

Expected: costs and operations are saved accurately and report totals reconcile.

### Test 6 — Dashboard, reports, and CSV

1. Select a date range containing all test entries.
2. Recalculate production, revenue, operating costs, investment, and profit manually or in Excel.
3. Compare those values with Home and Reports.
4. Filter milk entries by cow and buyer sales by buyer.
5. Export CSV, open it in Excel/Google Sheets, and confirm the date range, totals, source rows, and non-English text are correct.

Expected: every report total has supporting source rows and matches the independent calculation.

### Test 7 — Offline use and recovery

1. While online, wait for Sync status to show zero pending uploads.
2. Turn on airplane mode.
3. Add one milk entry and one expense; confirm they appear immediately.
4. Force-close and reopen while still offline.
5. Confirm the offline records still exist and can be viewed.
6. Restore internet and wait for pending uploads to reach zero.

Expected: saved offline records survive restart and synchronize after connectivity returns.

### Test 8 — Two-device synchronization

1. Install the same APK on device B and sign in with the same Google account.
2. On device A, add a cow, milk session, and expense while online; verify they arrive on B.
3. On B, edit a record; verify A receives the change.
4. Create a record offline on A, reconnect it, and confirm it appears on B.
5. Check Sync status on both devices after each part.

Expected: the same farm data appears on both devices without duplicated records.

### Test 9 — Conflict protection

1. Let both devices synchronize the same active record.
2. Take both offline.
3. Edit or void that record on A and make a competing change on B.
4. Reconnect A first, wait until synchronized, then reconnect B.
5. Check Sync status and correction history.

Expected: the app reports a conflict instead of silently losing either change. Treat a silent overwrite as release-blocking.

### Test 10 — Error handling and boundaries

1. Try saving required forms with blank required values.
2. Try invalid values: negative quantities/costs, invalid dates, overly long notes, and duplicate logical milk sessions where applicable.
3. Open the app with no internet before sign-in; then retry after reconnecting.
4. Switch Wi-Fi/mobile data during an upload.
5. Sign out only after all pending uploads are zero, then confirm no farm data is accessible until the correct account signs in.

Expected: clear validation messages, no crashes, no lost data, and no cross-account data access.

### Test 11 — Upgrade safety

1. With device A holding synchronized test data, install a newer APK over the existing app.
2. Open it and verify sign-in, local records, Home totals, and Sync status.
3. Add a new record and verify it syncs to device B.

Expected: the update installs without data loss. Stop if Android reports different signing certificates.

## 7. Failure report template

Copy this for every failure:

```text
Test number and title:
Pass / Fail:
Date and time:
Phone model / Android version:
App version:
Google account (email may be partially masked):
Network state:
Steps taken:
Expected result:
Actual result:
Did it persist after app restart? yes/no
Did it appear on the second device? yes/no/not tested
Sync status/error text:
Screenshot or screen recording:
```

## 8. Do not release for real farm use if any of these fail

- Google sign-in fails or opens an unmatched/blank route.
- An accepted save disappears after restart or reconnecting.
- The wrong Google account can access farm data.
- A two-device change silently overwrites another change.
- Dashboard/report totals do not reconcile with their records.
- Duplicate milk, expense, or operation records appear after sync.
- An update cannot be installed over the previous signed app.

For deeper developer troubleshooting, use [TESTING.md](TESTING.md).
