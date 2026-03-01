# Latest Context — 2026-03-01 23:22

## Current State
- **Branch**: dev session (merging to main)
- **App**: CPBQ React Dashboard — Next.js + Tailwind + BigQuery
- **URL**: Vercel production (auto-deploy on main push)

## Session Summary — Data Normalization & Import Tab Enhancements

### Tasks Completed
1. **Fixed inpatient/outpatient classification** — Aligned normalization tab logic with validation tab by using `loaiKCBMap` lookup instead of hardcoded `ml === 1` (both frontend in TabImport.tsx and API in normalize/route.ts via LEFT JOIN with `lookup_loaikcb`)
2. **Fixed delete count accuracy** — Explicit `getMetadata()` call after DML job for correct `numDmlAffectedRows`
3. **Added normalized/raw record status columns** — "Chuẩn hóa" and "Chưa chuẩn hóa" columns in normalization comparison table showing `is_normalized` counts from BQ
4. **Enhanced table readability** — `whitespace-nowrap` headers, `min-w-[160px]` on Tên CSKCB, horizontal scroll with `overflow-x-auto`
5. **Updated import description** — Bold first line with C79,80b-HD (CV3360) reference, second line with workflow steps
6. **Removed SectionTitle** — Cleaned up redundant header
7. **Improved footer row** — Shows unique CSKCB count (e.g. "3 CSKCB") and unique period count (e.g. "1 kỳ") instead of total rows
8. **Upload label update** — "Kéo thả hoặc click chọn file Excel theo mẫu C79,80b-HD (CV 3360)"
9. **Tab labels renamed** — "HỢP LỆ" → "BỆNH NHÂN MỚI", "TRÙNG LẶP" → "BỆNH NHÂN TRÙNG LẶP"
10. **Column width optimization** — Shrunk Kỳ QT and Mã CSKCB, right-aligned quantity/amount cols, "BQ" → "Data lưu"
11. **Added `is_normalized` column to data tables** — Import API fetches `is_normalized` from BQ, displays "x" for normalized rows, entire row text turns blue (`text-blue-600`), column in toggle menu with default checked
12. **DataTable component enhancement** — Cells use `text-inherit` when row has custom text color class, enabling row-level color styling

### Key Files Modified
- `src/app/overview/TabImport.tsx` — Import tab (UI, column defs, classification logic, normalization table)
- `src/app/api/bq/overview/normalize/route.ts` — Normalization API (lookup JOIN, delete count, normalized counts)
- `src/app/api/bq/overview/import/route.ts` — Import API (is_normalized fetch and return)
- `src/components/ui/DataTable.tsx` — Generic data table (row color inheritance)

### Architecture Notes
- `is_normalized` and `normalized_at` metadata fields on BQ records
- Import API returns `normalizedStatus` map alongside `duplicateIndices`
- `getRowClassName` in TabImport adds `text-blue-600` for normalized rows
- DataTable conditionally uses `text-inherit` on cells when row has text color class
- Normalization comparison uses `loaiKCBMap` for consistent inpatient/outpatient classification

### Pending / Next Session
- Visual verification of is_normalized column with real data
- Consider adding batch normalization status update
- Export functionality for normalization report
