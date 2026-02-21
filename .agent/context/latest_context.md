# CPBQ-React — Source of Truth

## Dự án
- **Tên**: CPBQ-React — Dashboard phân tích chi phí thanh toán BHYT
- **Tech stack**: Next.js 16 + TypeScript + CSS (vanilla) + BigQuery
- **Thư mục**: `/Users/buiminhkhoi/Documents/Antigravity/cpbq-react/`
- **Dự án gốc (Streamlit)**: `/Users/buiminhkhoi/Documents/Antigravity/CPBQ/`
- **BigQuery Project**: `cpbq-487004`, dataset `cpbq_data`, view `v_thanh_toan`
- **GitHub**: `khoibmtn/CPBQ-React`

## Trạng thái hiện tại — 2026-02-22

### Latest Session (2026-02-22 06:30)

#### Tasks Completed
- [x] **ICD Analysis Excel Export** — Added `exportIcdAnalysis` to `lib/exportExcel.ts` using ExcelJS (same pattern as `exportCostByDept`): merged headers, thin borders, auto-width columns, blue ICD codes, total row. Download button "📥 Tải Excel" added to `icd-analysis/page.tsx`
- [x] **LookupEditor redesign** — Rewrote `components/settings/LookupEditor.tsx` from always-editable inputs to read-only table with inline edit mode: bordered table wrapper with rounded corners, gray header row with uppercase labels, alternating row colors (white/`#f8fafc`), hover highlight, `table-layout: fixed` to prevent column shift, pencil/trash icon buttons per row, amber background for editing row with confirm/cancel buttons
- [x] **Khoa table column widths** — Added `width` property to `Column` interface in LookupEditor; set specific widths for Khoa columns (thứ tự 65px, mã CSKCB 80px, mã khoa XML 95px, tên rút gọn 110px, hiệu lực 95px) so Tên đầy đủ gets remaining space
- [x] **MergeManager UI redesign** — Rewrote `components/settings/MergeManager.tsx` to match Stitch design: bordered cards with gray header for Khoa đích section, divider line between target and sources, source items as gray rows with trash icons and hover effects, dashed-border dropdown for adding new sources, closeable alerts, indigo Save button with shadow, Lucide icons throughout
- [x] **ICD Analysis UI fixes** (previous session) — Dropdown overlap fix, legend removal, header row 2 styling with period-based background colors

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
- [x] **Trang Chi phí theo khoa** (cost-by-dept) — multi-period comparison, khoa merge, profile columns, Excel export
- [x] **Trang Chi phí theo mã bệnh** (icd-analysis) — ICD-3 analysis, cumulative %, filters, Excel export
- [x] **Trang Cấu hình** (settings) — lookup CRUD with table-style UI (inline edit), profile management, khoa merge groups (Stitch-inspired design)

### Settings Page — Chi tiết kỹ thuật
- **LookupEditor** (`components/settings/LookupEditor.tsx`): Generic table editor for all lookup tabs (Loại KCB, Cơ sở KCB, Khoa). Read-only by default with pencil/trash icons; inline editing with confirm/cancel. Supports per-column `width` property. Uses `table-layout: fixed` and inline styles for bordered table with alternating rows.
- **MergeManager** (`components/settings/MergeManager.tsx`): Stitch-inspired card layout for merge groups. Each card has gray header (khoa đích dropdown + delete button), divider, source list (gray rows with trash), dashed-border add dropdown. Indigo save button. Uses Lucide icons (Trash2, Plus, Save).
- **ProfileManager** (`components/settings/ProfileManager.tsx`): Profile column configuration

### Import Tab — Chi tiết kỹ thuật
- **Backend POST** `/api/bq/overview/import`: Trả row-level data cho tất cả sheet (full SCHEMA_COLS), mỗi dòng có `_isDuplicate` flag
- **Backend PUT**: `mode=new` (insert dòng mới) / `mode=overwrite` (DELETE bản cũ theo composite key + INSERT mới)
- **Date parsing**: `parseDateInt` accepts integer `19770902` + ISO `1977-09-02` + Excel serial; `parseDatetimeStr` accepts compact `YYYYMMDDHHmm` + ISO `YYYY-MM-DDThh:mm:ss`
- **Per-sheet state**: `sheetDoneRows/sheetDoneMode/sheetCheckedRows/sheetRemovedRows` ref Maps persist across sheet switches
- **Upload messages**: Map<`sheetName:tab`, message> — scoped per sheet+tab
- **Column visibility**: `colMode` (`all`/`custom`), saved to `localStorage('import_visible_cols')`
- **Export**: Reverse-transforms dates to original format before writing Excel

### Excel Export — Chi tiết kỹ thuật
- **`lib/exportExcel.ts`**: Contains `exportHospitalStats` (xlsx library), `exportCostByDept` (ExcelJS), `exportIcdAnalysis` (ExcelJS)
- **ExcelJS pattern**: Workbook → Worksheet → addRow → styleRow (thin borders, fonts, alignment) → mergeCells → auto-width columns → writeBuffer → saveAs blob
- **ICD export specifics**: Merged period headers, sub-column labels (Số lượt, Ngày ĐTTB, BQĐT, %CP), optional diff columns, blue ICD code font, total row

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
│   ├── icd-analysis/page.tsx            ✅ (+ Excel export button)
│   ├── settings/page.tsx                ✅ (column widths config)
│   └── api/bq/
│       ├── hospital-stats/route.ts
│       ├── overview/import/route.ts     ✅ (ISO date parsing, full SCHEMA_COLS preview)
│       ├── overview/manage/route.ts
│       └── ...
├── components/
│   ├── ui/
│   │   ├── DataTable.tsx                ✅ (disabledRows, rowClassName, pagination input)
│   │   ├── SearchBuilder.tsx
│   │   └── ...
│   └── settings/
│       ├── LookupEditor.tsx             ✅ (table-style with inline edit, column widths)
│       ├── MergeManager.tsx             ✅ (Stitch-inspired card UI)
│       └── ProfileManager.tsx
└── lib/
    ├── config.ts, bigquery.ts, formatters.ts, schema.ts
    ├── exportExcel.ts                   ✅ (exportHospitalStats, exportCostByDept, exportIcdAnalysis)
    └── metrics.ts
```

## Workflows
- `/load-context`: Load context + skills/rules/workflows + tạo nhánh dev + dev server
- `/sync`: Commit WIP → merge main → push (deploy) → tag → quay lại nhánh dev
- `/save-context`: Save context + commit + merge main → push (deploy) → tag → cleanup

## Lệnh chạy
- Dev server: `npm run dev`
- Build: `npm run build`
- Port mặc định: 3000
