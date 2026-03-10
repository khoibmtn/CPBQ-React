# Latest Context — 2026-03-10 19:00

## Session Summary
Implemented lazy-mount + keep-alive pattern to preserve page/tab state across navigation.

## Tasks Completed
- Created `PageShell.tsx` — renders all visited pages, hides inactive ones with CSS `display:none`
- Modified `layout.tsx` — integrated PageShell alongside hidden Next.js `{children}` for URL routing
- Added `panels` prop to `TabGroup.tsx` — lazy-mount + CSS-hide for individual tabs within pages
- Updated `SettingsPage` — uses `panels` prop (fixes BigQuery rate limit errors from tab switching)
- Updated `OverviewPage` — uses `panels` prop (sub-tabs keep state)
- Added `useMemo` to SettingsPage panels to prevent flicker on lock/unlock toggle

## Key Files Modified
- `src/components/layout/PageShell.tsx` [NEW] — lazy-mount + keep-alive page shell
- `src/app/layout.tsx` — integrated PageShell
- `src/components/ui/TabGroup.tsx` — added `panels` prop for keep-alive tabs
- `src/app/settings/page.tsx` — panels prop + useMemo stabilization
- `src/app/overview/page.tsx` — panels prop

## Architecture Notes
- **Page-level**: `PageShell` tracks `visited: Set<string>`, renders pages only after first visit, hides inactive with `display:none`
- **Tab-level**: `TabGroup.panels` prop does the same for tabs within a page
- **URL routing**: Still uses Next.js `<Link>` + `usePathname()`, `{children}` hidden but present
- **Backward compat**: `TabGroup` still supports old `children` render-prop pattern
