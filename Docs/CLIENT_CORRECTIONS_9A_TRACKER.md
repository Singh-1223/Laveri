# Client Corrections 9a

## Status

- [x] C9A-01 Milk Calf category and consumption allocation
- [x] C9A-02 Auto-select Morning or Evening on fresh Milk Entry opening
- [x] C9A-03 Edit and delete Heat/AI and Lactation records
- [x] C9A-04 Replace Farm Operations void flow with delete
- [x] C9A-05 FAT and SNF dual-session line graphs in Reports
- [x] C9A-06 Daily Dairy categories, management, and filtering

## Confirmed decision

Milk Calf is a third selectable Milk Entry category. Only animals marked Milk Calf use the calf-consumption allocation section; their quantities reduce the remaining produced milk and are never treated as additional production.

## Deployment note

The schema migration `202609210001_correction_9a_foundation.sql` and corresponding PowerSync Sync Streams must be deployed after code is complete. Device testing is still required before any APK build.

## Implementation notes

- Milk Calf uses a dedicated 0–7.25 L, 0.25 L-step suggestion grid with no horizontal paging. Its total is deducted from produced milk before household consumption is calculated.
- A newly mounted Milk Entry screen chooses Morning before noon and Evening from noon onward; the session tabs remain available for correction.
- Heat/AI and Lactation entries can now be edited or deleted with confirmation.
- Farm Operations now uses confirmed Delete. Deleted records are hidden from Recent activity and excluded from totals while retaining an offline-safe deletion audit.
- Reports adds separate FAT and SNF graphs with Morning and Evening lines, 10-day/one-month/three-month/custom ranges, and excludes today.
- Daily Dairy supports Regular or custom categories, filtering, and category add/edit/delete. Removing a category preserves its diary entries as Regular.
