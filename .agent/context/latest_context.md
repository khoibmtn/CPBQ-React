# Latest Context — Session 2026-09-28

## Summary
Session focused on enhancing the data management page (Quản lý số liệu) with advanced analytics and filtering features.

## Tasks Completed

### 1. Fixed Data Discrepancy in Excel Export
- Root cause: pagination data loss — BQ query lacked deterministic sorting keys
- Fix: added `ma_bn`, `ngay_vao`, `ngay_ra` to ORDER BY clause

### 2. Unified InsightPanel (Tabbed Stats)
- Created `InsightPanel.tsx` wrapping `DataInsight` (1D stats) + `CrossTab` (2D cross-tab) in tabs
- Summary cards (Số dòng, Chuẩn hóa) always visible in header bar
- Tab state persisted via BigQuery settings API (`key=insight_panel_tab`)
- Both components accept `embedded` prop for seamless integration

### 3. CrossTab 2D Cross-Tabulation
- Created `CrossTab.tsx` — row/col dimensions, count/sum modes, totals
- Config persisted via `key=cross_tab_config` in settings API
- All numbers displayed in full format (no compact "6.1T")

### 4. CrossTab Column Sorting
- Tri-state sort: click 1 = ascending, click 2 = descending, click 3 = reset
- Sort by any data column, row labels, or row totals
- Visual indicators: muted arrow (inactive), indigo arrow (active)

### 5. Month Range Filter
- Checkbox "Cả năm" (default ON) next to Phương pháp dropdown
- Unchecking reveals month range selectors (Từ tháng 1-12 đến tháng 1-12)
- Cross-year logic: fromMonth/fromYear → toMonth/toYear
- Uses composite key `(nam_qt*100+thang_qt)` for BQ filtering
- Applied to all API actions (count, load, search)

## Key Files Modified
- `src/app/overview/InsightPanel.tsx` — NEW, tab wrapper
- `src/app/overview/CrossTab.tsx` — 2D cross-tab with sorting
- `src/app/overview/DataInsight.tsx` — embedded mode support
- `src/app/overview/TabManage.tsx` — month filter UI, InsightPanel integration
- `src/app/api/bq/overview/manage/route.ts` — month range filtering

## Architecture Notes
- CrossTab configs stored in BQ settings: `key=cross_tab_config`
- InsightPanel tab stored in BQ settings: `key=insight_panel_tab`
- Month filter state stored in sessionStorage: `mg_fullYear`, `mg_fromMonth`, `mg_toMonth`
- `buildMonthFilter()` helper in manage API for SQL WHERE clause generation
