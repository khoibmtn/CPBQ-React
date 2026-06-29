# Latest Context — 2026-06-29

## Session Summary
Phiên làm việc tập trung vào 3 tính năng chính cho CPBQ Dashboard:

### 1. CostCategoryPicker (ICD Analysis)
- Thêm dropdown multi-select cho phép chọn danh mục chi phí: Thuốc, XN, CĐHA, Máu, PTTT, VTYT, Tiền giường
- Mỗi danh mục có mode: Số tiền / Bình quân / Tỷ lệ (chỉ Thuốc có Tỷ lệ)
- API mở rộng thêm 7 SUM fields trong SQL query
- Inline styles 100% để tránh Tailwind purge issues

### 2. ICD-10 Lookup Tab (Settings)
- Import 15,844 dòng từ `icd10.xlsx` vào BigQuery table `lookup_icd10`
- Tạo tab "ICD 10" trong trang Cấu hình với:
  - Fuzzy search (multi-token, relevance scoring, sorted results)
  - Keyword highlighting trong kết quả tìm kiếm
  - Column visibility toggle (29 cột, default 8 cột chính)
  - Config persist trên BigQuery table `lookup_icd10_config`

### 3. Disease Name Column (ICD Analysis)
- Toggle bật/tắt cột "Tên bệnh" trong bảng Chi phí theo mã bệnh
- Tra cứu từ bảng ICD-10 qua `ma_benh_ko_dau`
- Word-wrap cho tên bệnh dài, minWidth 220px, maxWidth 320px

### 4. DataTable Text Wrapping
- Bỏ truncation CSS (nowrap, text-ellipsis) khỏi `.data-table-compact td`
- Thêm `word-break: break-word` để nội dung dài tự xuống dòng

## Key Files Modified
- `src/app/icd-analysis/CostCategoryPicker.tsx` — NEW
- `src/app/icd-analysis/IcdTable.tsx` — disease name column + cost categories
- `src/app/icd-analysis/page.tsx` — toggle state + ICD-10 name map
- `src/components/settings/Icd10Browser.tsx` — NEW
- `src/app/settings/page.tsx` — ICD 10 tab
- `src/app/api/bq/icd-analysis/route.ts` — 7 new cost fields
- `src/app/api/bq/lookup/route.ts` — 2 new allowed tables
- `src/lib/config.ts` — table constants
- `src/app/globals.css` — text wrap fix
- `scripts/import-icd10.mjs` — import script

## BigQuery Tables Created
- `cpbq_data.lookup_icd10` — 15,844 rows, 29 columns
- `cpbq_data.lookup_icd10_config` — column visibility settings

## Architecture Notes
- ICD-10 name lookup is loaded client-side (15k rows ~5s) and cached in React state
- Fuzzy search uses token-based scoring with field priority weighting
- CostCategoryPicker uses inline styles exclusively (Tailwind purge-safe)
- Column visibility config saved to BigQuery with 1.5s debounce
