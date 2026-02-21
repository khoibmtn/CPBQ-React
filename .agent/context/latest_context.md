# CPBQ-React — Source of Truth

## Dự án
- **Tên**: CPBQ-React — Dashboard phân tích chi phí thanh toán BHYT
- **Tech stack**: Next.js 16 + TypeScript + CSS (vanilla) + BigQuery
- **Thư mục**: `/Users/buiminhkhoi/Documents/Antigravity/cpbq-react/`
- **Dự án gốc (Streamlit)**: `/Users/buiminhkhoi/Documents/Antigravity/CPBQ/`
- **BigQuery Project**: `cpbq-487004`, dataset `cpbq_data`, view `v_thanh_toan`
- **GitHub**: `khoibmtn/CPBQ-React`

## Trạng thái hiện tại — 2026-02-21

### Latest Session (2026-02-21 11:35)

#### Tasks Completed
- [x] **Excel Export date format fix** — Reverse-transform ISO dates back to original compact format in export (`1977-09-02` → `19770902`, `2026-01-02T07:35:00` → `'202601020735`)
- [x] **Import date parsing fix** — Updated `parseDateInt` and `parseDatetimeStr` to accept ISO-formatted dates/datetimes, enabling re-import of exported files
- [x] **Per-sheet state persistence** — Upload/overwrite status (`doneRows`, `doneMode`, `checkedRows`, `removedRows`) now persists across sheet switches via ref Maps
- [x] **Per-sheet+tab upload messages** — `uploadMsg` changed to Map keyed by `sheetName:tab`, messages only show in relevant tab and persist across tab/sheet switches
- [x] **Import preview all columns** — Changed from 14 hardcoded `DISPLAY_COLS` to full `SCHEMA_COLS` so all columns (e.g., `ma_loaikcb`) have data
- [x] **Column visibility menu improvements** — Opaque background (was semi-transparent), `colMode` toggle (`Tất cả` / `Tùy chỉnh`), localStorage persistence across sessions
- [x] **Workflow rewrite** — Updated `/load-context`, `/sync`, `/save-context` for CPBQ-React (Next.js, branching, deploy)

### Đã hoàn thành (tổng)
- [x] Khởi tạo dự án Next.js (App Router, TypeScript)
- [x] Design system CSS (dark/light theme, Inter font)
- [x] Layout: Sidebar navigation, ThemeProvider
- [x] Shared UI: PageHeader, MetricCard, SectionTitle, InfoBanner, DataTable, SearchBuilder
- [x] **Trang Số liệu tổng hợp** (hospital-stats) — multi-period comparison
- [x] **Trang Quản lý số liệu** (overview) — 3 tab: Pivot, Manage, Import
  - [x] TabPivot: pivot summary display
  - [x] TabManage: multi-condition search, row select/delete, Excel export (schema-ordered, original date format)
  - [x] TabImport: row-level data, sheet selector, summary/valid/duplicate tabs, column toggle with localStorage, per-sheet state persistence
- [x] **Trang Chi phí theo khoa** (cost-by-dept) — multi-period comparison, khoa merge, profile columns
- [x] **Trang Chi phí theo mã bệnh** (icd-analysis) — ICD-3 analysis, cumulative %, filters
- [x] **Trang Cấu hình** (settings) — lookup CRUD, profile management, khoa merge groups

### Import Tab — Chi tiết kỹ thuật
- **Backend POST** `/api/bq/overview/import`: Trả row-level data cho tất cả sheet (full SCHEMA_COLS), mỗi dòng có `_isDuplicate` flag
- **Backend PUT**: `mode=new` (insert dòng mới) / `mode=overwrite` (DELETE bản cũ theo composite key + INSERT mới)
- **Date parsing**: `parseDateInt` accepts integer `19770902` + ISO `1977-09-02` + Excel serial; `parseDatetimeStr` accepts compact `YYYYMMDDHHmm` + ISO `YYYY-MM-DDThh:mm:ss`
- **Per-sheet state**: `sheetDoneRows/sheetDoneMode/sheetCheckedRows/sheetRemovedRows` ref Maps persist across sheet switches
- **Upload messages**: Map<`sheetName:tab`, message> — scoped per sheet+tab
- **Column visibility**: `colMode` (`all`/`custom`), saved to `localStorage('import_visible_cols')`
- **Export**: Reverse-transforms dates to original format before writing Excel

## Cấu trúc file chính

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   ├── hospital-stats/page.tsx          ✅
│   ├── overview/
│   │   ├── page.tsx                     ✅
│   │   ├── TabPivot.tsx                 ✅
│   │   ├── TabManage.tsx                ✅ (Excel export with date reverse-transform)
│   │   └── TabImport.tsx                ✅ (per-sheet state, col mode, scoped messages)
│   ├── cost-by-dept/page.tsx            ✅
│   ├── icd-analysis/page.tsx            ✅
│   ├── settings/page.tsx                ✅
│   └── api/bq/
│       ├── hospital-stats/route.ts
│       ├── overview/import/route.ts     ✅ (ISO date parsing, full SCHEMA_COLS preview)
│       ├── overview/manage/route.ts
│       └── ...
├── components/ui/
│   ├── DataTable.tsx                    ✅ (disabledRows, rowClassName, pagination input)
│   ├── SearchBuilder.tsx
│   └── ...
└── lib/
    ├── config.ts, bigquery.ts, formatters.ts, schema.ts
```

## Workflows
- `/load-context`: Load context + skills/rules/workflows + tạo nhánh dev + dev server
- `/sync`: Commit WIP → merge main → push (deploy) → tag → quay lại nhánh dev
- `/save-context`: Save context + commit + merge main → push (deploy) → tag → cleanup

## Lệnh chạy
- Dev server: `npm run dev`
- Build: `npm run build`
- Port mặc định: 3000
