# CPBQ-React — Source of Truth

## Dự án
- **Tên**: CPBQ-React — Dashboard phân tích chi phí thanh toán BHYT
- **Tech stack**: Next.js 16 + TypeScript + CSS (vanilla) + BigQuery
- **Thư mục**: `/Users/buiminhkhoi/Documents/Antigravity/cpbq-react/`
- **Dự án gốc (Streamlit)**: `/Users/buiminhkhoi/Documents/Antigravity/CPBQ/`
- **BigQuery Project**: `cpbq-487004`, dataset `cpbq_data`, view `v_thanh_toan`
- **GitHub**: `khoibmtn/CPBQ-React`

## Trạng thái hiện tại — 2026-02-21

### Latest Version
- **Tag**: `v20260221-0031-import-redesign`
- **Commit**: `39d8a9b` on `main`

### Đã hoàn thành
- [x] Khởi tạo dự án Next.js (App Router, TypeScript)
- [x] Design system CSS (dark/light theme, Inter font)
- [x] Layout: Sidebar navigation, ThemeProvider
- [x] Shared UI: PageHeader, MetricCard, SectionTitle, InfoBanner, DataTable, SearchBuilder
- [x] **Trang Số liệu tổng hợp** (hospital-stats) — multi-period comparison
- [x] **Trang Quản lý số liệu** (overview) — 3 tab: Pivot, Manage, Import
  - [x] TabPivot: pivot summary display
  - [x] TabManage: multi-condition search, row select/delete with confirmation
  - [x] TabImport: **Redesigned** — row-level data, sheet selector, valid/duplicate tabs, search, checkboxes, post-upload tracking
- [x] **Trang Chi phí theo khoa** (cost-by-dept) — multi-period comparison, khoa merge, profile columns
- [x] **Trang Chi phí theo mã bệnh** (icd-analysis) — ICD-3 analysis, cumulative %, filters
- [x] **Trang Cấu hình** (settings) — lookup CRUD, profile management, khoa merge groups

### Import Tab — Chi tiết kỹ thuật (mới nhất)
- **Backend POST** `/api/bq/overview/import`: Trả row-level data cho tất cả sheet, mỗi dòng có `_isDuplicate` flag
- **Backend PUT**: `mode=new` (insert dòng mới) / `mode=overwrite` (DELETE bản cũ theo composite key + INSERT mới)
- **Composite key**: `ma_cskcb + ma_bn + ma_loaikcb + ngay_vao + ngay_ra`
- **Frontend state**: `doneRows` (Set) + `doneMode` (map) tracking sau upload
- **DataTable**: `disabledRows` prop, `rowClassName` callback, Select All skips disabled
- **Status column**: `Chưa tải lên` → `✅ Đã tải lên` / `✅ Đã ghi đè`
- **CSS**: `.btn-warning` (amber gradient), `.row-done` (green bg, muted text)

## Cấu trúc file chính

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   ├── hospital-stats/page.tsx          ✅
│   ├── overview/
│   │   ├── page.tsx                     ✅
│   │   ├── TabPivot.tsx                 ✅
│   │   ├── TabManage.tsx                ✅
│   │   └── TabImport.tsx                ✅ (redesigned)
│   ├── cost-by-dept/page.tsx            ✅
│   ├── icd-analysis/page.tsx            ✅
│   ├── settings/page.tsx                ✅
│   └── api/bq/
│       ├── hospital-stats/route.ts
│       ├── overview/import/route.ts     ✅ (row-level + overwrite)
│       ├── overview/manage/route.ts
│       └── ...
├── components/ui/
│   ├── DataTable.tsx                    ✅ (disabledRows, rowClassName)
│   ├── SearchBuilder.tsx
│   └── ...
└── lib/
    ├── config.ts, bigquery.ts, formatters.ts, schema.ts
```

## Lệnh chạy
- Dev server: `npm run dev`
- Build: `npm run build`
- Port mặc định: 3000
