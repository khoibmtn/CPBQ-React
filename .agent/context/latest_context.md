# Latest Context — 2026-03-03 09:06

## Session Summary
Implemented Config Tab Unlock mechanism for the CPBQ Dashboard.

## Tasks Completed
- Added `readOnly` prop to `LookupEditor`, `ProfileManager`, `MergeManager`
- Added `extra` prop to `PageHeader` component
- Updated `SettingsPage` with unlock/lock state using localStorage (`settings_unlocked` key) + prompt for code `123456`
- When locked: hides Save/Add/Edit/Delete buttons, disables dropdowns in Profiles & MergeManager
- PalettePicker (Giao diện tab) remains always editable
- Extended lock to `TabImport` — shows locked message when not unlocked
- Extended lock to `TabManage` — hides delete button and disables row selection when locked
- Synced and deployed to main

## Key Files Modified
- `src/app/settings/page.tsx` — unlock state + localStorage + button in header
- `src/components/settings/LookupEditor.tsx` — readOnly prop
- `src/components/settings/ProfileManager.tsx` — readOnly prop + disabled dropdown
- `src/components/settings/MergeManager.tsx` — readOnly prop + disabled dropdown
- `src/components/ui/PageHeader.tsx` — added `extra` prop
- `src/app/overview/TabImport.tsx` — locked guard with message
- `src/app/overview/TabManage.tsx` — hide delete, disable selection

## Architecture Notes
- Unlock state stored in localStorage key `settings_unlocked` = `"true"`
- Unlock code: `123456` (hardcoded)
- All components read the same localStorage key for consistency
