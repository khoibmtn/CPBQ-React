# Latest Context — Session 2026-10-04

## Summary
Session focused on resolving dynamic department mapping in BigQuery VIEW `v_thanh_toan` (Thận nhân tạo changing codes across time periods), researching multi-modal care departments (both inpatient and outpatient such as YHCT-PHCN), and completely redesigning the Record Editing Modal (`EditRecordModal.tsx`) in Data Management.

## Tasks Completed

### 1. Dynamic Department Mapping for Thận nhân tạo (`v_thanh_toan`)
- **Root cause**: `v_thanh_toan` hardcoded `WHEN t.ma_khoa = 'K35'`, breaking outpatient identification when the code changed to `K024849.D35` from 01/09/2026.
- **Fix**: Updated `v_thanh_toan` DDL on BigQuery to dynamically check `COALESCE(kp.short_name, kp2.short_name) = 'Thận nhân tạo' OR t.ma_khoa = 'K35'`.
- **Architectural clarification**: Distinguished between "Timeline Versioning" (same department changing codes/names over time via `valid_from`/`valid_to` in `lookup_khoa`, compared seamlessly year-over-year) vs "Merging" (combining multiple separate departments via `lookup_khoa_merge`).
- **Artifacts**: Created `scripts/views/v_thanh_toan.sql` for git version control; updated `docs/excel-export-schema.md`.

### 2. Multi-modal Department Handling Research (Inpatient + Outpatient)
- Analyzed real BHYT data for `K1631` (Khoa YHCT-PHCN): 7,045 inpatient, 1,089 day treatment, 978 outpatient clinic, 124 outpatient treatment.
- Formulated 3 architectural options to preserve department names for outpatient treatment cases instead of aggregating them all into generic "Điều trị ngoại trú".

### 3. Complete Redesign of Record Editing Modal (`EditRecordModal.tsx`)
- **Root cause**: CSS flexbox shrink bug (`flex-shrink: 1` on items inside `max-height: 90vh` container with `overflow: hidden`) squished groups to 10px-20px, cutting off inputs.
- **4 Professional Tabs**:
  - 👤 **Bệnh nhân & Thẻ BHYT**: Administrative info, demographics, health insurance card details, validity dates.
  - 🩺 **Khám & Điều trị**: Primary/secondary ICD-10 diagnoses, admission/discharge timestamps, treatment days, smart dropdowns for reasons, treatment outcomes, and discharge status.
  - 💰 **Chi phí KCB**: 4 KPI cards (Tổng chi, BH thanh toán, BN thanh toán, Ngoài DS) + 20 detailed cost items organized into categories with VND currency formatting (`₫`).
  - 📋 **Phân loại & Hệ thống**: Intelligent dropdowns for Khoa (from `lookup_khoa`), Loại KCB (from `lookup_loaikcb`), Cơ sở KCB (from `lookup_cskcb`), plus read-only mapped fields and audit metadata.
- **Change Tracking & Revert**:
  - Highlights modified fields with amber borders and backgrounds.
  - Displays original value (`Gốc: ...`).
  - Per-field undo button (`↺ Khôi phục`) and global `Hoàn tác tất cả`.
- **Verification**: Verified successfully in browser via subagent with unlocked editing.

## Key Files Modified
- `src/app/overview/EditRecordModal.tsx` — Full redesign with tabs, dropdowns, change tracking, and responsive layout.
- `scripts/views/v_thanh_toan.sql` — NEW, version-controlled DDL for BigQuery VIEW `v_thanh_toan`.
- `docs/excel-export-schema.md` — Updated with `K024849.D35` timeline and dynamic resolution notes.

## Next Steps / Notes for Future Sessions
- Multi-modal outpatient treatment: Implement Option 1 (auto-preserve department names for clinical departments while grouping K01 clinic cases into "Điều trị ngoại trú") or Option 2 (add `is_ngoaitru_rieng` boolean column in `lookup_khoa`).
