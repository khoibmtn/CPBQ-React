# CPBQ-React — Source of Truth

## Dự án
- **Tên**: CPBQ-React — Dashboard phân tích chi phí thanh toán BHYT
- **Tech stack**: Next.js 16 + TypeScript + Tailwind CSS + BigQuery
- **Thư mục**: `/Users/buiminhkhoi/Documents/Antigravity/cpbq-react/`
- **Dự án gốc (Streamlit)**: `/Users/buiminhkhoi/Documents/Antigravity/CPBQ/`
- **BigQuery Project**: `cpbq-487004`, dataset `cpbq_data`, view `v_thanh_toan`

## Trạng thái hiện tại — Phase 1 HOÀN THÀNH ✅

### Đã hoàn thành
- [x] Khởi tạo dự án Next.js (App Router, TypeScript, Tailwind)
- [x] Cài đặt dependencies: `@google-cloud/bigquery`, `xlsx`
- [x] `src/lib/config.ts` — BigQuery constants (PROJECT_ID, DATASET_ID, table names)
- [x] `src/lib/bigquery.ts` — Server-side BQ client (service account + env vars)
- [x] `src/lib/formatters.ts` — Formatting utilities (fmt, fmtDec, pctChange, diffValue, bq)
- [x] `src/app/globals.css` — Design system CSS (dark/light theme variables, Inter font)
- [x] `src/components/ThemeProvider.tsx` — Dark/light theme toggle with localStorage
- [x] `src/components/layout/Sidebar.tsx` — Navigation sidebar (5 trang)
- [x] Shared UI components: `PageHeader`, `MetricCard`, `SectionTitle`, `InfoBanner`
- [x] **Trang Số liệu tổng hợp** (hospital-stats) — multi-period comparison, ratio %, chênh lệch
- [x] API route `/api/bq/hospital-stats` — GET (year/months) + POST (period data)
- [x] 4 trang stub: overview, cost-by-dept, icd-analysis, settings
- [x] `npm run build` thành công, dev server hoạt động
- [x] Git repo đã khởi tạo (by create-next-app)

### Chưa hoàn thành
- [ ] Push lên GitHub repo mới (`khoibmtn/cpbq-react`)
- [ ] Cấu hình BigQuery service account credentials
- [ ] Excel export cho trang Hospital Stats

## Kế hoạch tiếp theo (Phase 2–5)

### Phase 2: Trang Quản lý số liệu (overview)
- 3 tab: Pivot summary, Data management (multi-condition search, select/delete rows), Import Excel
- Port từ `CPBQ/views/overview.py` (1,709 dòng)
- API routes: `/api/bq/overview`, `/api/bq/data-management`

### Phase 3: Trang Chi phí theo khoa (cost-by-dept)
- Multi-period comparison by department
- Profile-driven column selection (from lookup_profiles table)
- Khoa merge rules (from lookup_khoa_merge table)
- Excel export
- Port từ `CPBQ/views/cost_by_dept.py` (1,410 dòng)

### Phase 4: Trang Chi phí theo mã bệnh (icd-analysis)
- ICD-3 analysis by period
- Cumulative % filtering
- Khoa/ml2 filters
- Excel export
- Port từ `CPBQ/views/icd_analysis.py` (1,036 dòng)

### Phase 5: Trang Cấu hình (settings)
- Lookup tables CRUD (3 bảng: Loại KCB, Cơ sở KCB, Khoa)
- Profile management (reorder + visibility)
- Khoa merge groups
- Port từ `CPBQ/views/settings.py` (1,049 dòng)

## Cấu trúc file hiện tại

```
src/
├── app/
│   ├── layout.tsx              # Root layout + Sidebar + ThemeProvider
│   ├── page.tsx                # Home → redirect to /hospital-stats
│   ├── globals.css             # Design system (dark/light themes)
│   ├── hospital-stats/page.tsx # ✅ Full implementation
│   ├── overview/page.tsx       # 🚧 Stub
│   ├── cost-by-dept/page.tsx   # 🚧 Stub
│   ├── icd-analysis/page.tsx   # 🚧 Stub
│   ├── settings/page.tsx       # 🚧 Stub
│   └── api/bq/hospital-stats/route.ts  # ✅ API endpoint
├── components/
│   ├── ThemeProvider.tsx
│   ├── layout/Sidebar.tsx
│   └── ui/ (PageHeader, MetricCard, SectionTitle, InfoBanner)
└── lib/
    ├── config.ts
    ├── bigquery.ts
    └── formatters.ts
```

## Lệnh chạy
- Dev server: `npm run dev`
- Build: `npm run build`
- Port mặc định: 3000
