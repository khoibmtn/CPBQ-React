---
description: Bắt đầu phiên - Load context, tạo nhánh mới, khởi động dev server
---

// turbo-all

1. Read Source of Truth
2. Run `cat .agent/context/latest_context.md`
3. List recent session logs
4. Run `ls -lt .agent/context/context-*.md 2>/dev/null | head -n 5`
5. Read all project workflows
6. Run `for f in .agent/workflows/*.md; do echo "=== $f ==="; cat "$f"; echo; done`
7. Read all project skills (SKILL.md files)
8. Run `for f in .agent/skills/*/SKILL.md; do echo "=== $f ==="; cat "$f"; echo; done`
9. Read project rules if any
10. Run `cat .agent/rules.md 2>/dev/null || cat .agent/RULES.md 2>/dev/null || echo "No rules file found"`
11. Create a new working branch from main
12. Run `git checkout main && git pull origin main && git checkout -b dev/$(date +%Y%m%d-%H%M)`
13. Start Next.js dev server
14. Run `cd /Users/buiminhkhoi/Documents/Antigravity/cpbq-react && npm run dev`
15. Wait a few seconds, check the command output for compile errors.
16. Confirm the app is running at http://localhost:3000 and report to user.
