# Latest Context — 2026-03-02 14:56

## Current State
- **Branch**: main (session ended)
- **App**: CPBQ React Dashboard — Next.js + Tailwind + BigQuery
- **URL**: Vercel production (auto-deploy on main push)

## Session Summary — Progress Indicators & TabManage Defaults

### Tasks Completed
1. **Progress indicators for Upload/Overwrite/Normalize** — Added `ProgressState` interface and real-time progress tracking to `TabImport.tsx`:
   - Upload new: `"Đang tải lên 1500/2157 (70%)"` + animated progress bar (indigo)
   - Overwrite: `"Đang ghi đè 1500/2157 (70%)"` + animated progress bar (indigo)
   - Normalize: 2-step progress — `"Đang xóa hồ sơ cũ..."` → `"Đang thêm hồ sơ mới... 200/1000 (20%)"` + animated progress bar (teal)
   - Progress bars use Tailwind `transition-all duration-500 ease-out` for smooth animation
   - No API changes needed — frontend tracks chunks that already existed

2. **TabManage year defaults** — Changed `TabManage.tsx`:
   - Both "Năm bắt đầu" and "Năm kết thúc" now default to current year (2026) instead of oldest→newest range
   - Removed auto-reload on mount — waits for user to click "Tải dữ liệu"

### Key Files Modified
- `src/app/overview/TabImport.tsx` — Progress state, handleUpload tracking, handleNormalizeExecute 2-step tracking, progress bar UI
- `src/app/overview/TabManage.tsx` — Year defaults, removed auto-reload useEffect

### Architecture Notes
- `ProgressState { current, total, step? }` — shared interface for both upload and normalize progress
- `uploadProgress` / `normalizeProgress` — separate state for each operation type
- Progress updates happen after each chunk response (1500 rows/chunk for upload, per-group for normalize)
- Progress bar colors: indigo for upload, teal for normalize (matching existing button colors)

### Pending / Next Session
- Visual verification of progress bars with real data (>1500 rows to trigger chunking)
- Consider adding progress for validation step (POST /api/bq/overview/import)
