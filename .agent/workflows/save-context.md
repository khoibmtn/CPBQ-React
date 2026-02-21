---
description: Kết thúc phiên - Lưu context, commit, push, deploy
---

// turbo-all

1. Update Source of Truth — edit `.agent/context/latest_context.md` with current session summary, tasks completed, and any important notes for next session.
2. Capture Session Log
3. Run `TS=$(date +%Y%m%d-%H%M); FILE_NAME=.agent/context/context-$TS.md; echo "# Session Log - $TS" > $FILE_NAME; echo "" >> $FILE_NAME; echo "## Tasks Completed" >> $FILE_NAME; git log --oneline main..HEAD >> $FILE_NAME 2>/dev/null || git log -n 10 --oneline >> $FILE_NAME; echo "" >> $FILE_NAME; echo "## Files Changed" >> $FILE_NAME; git diff --stat main..HEAD >> $FILE_NAME 2>/dev/null || git diff --stat HEAD~10 >> $FILE_NAME`
4. Auto-cleanup old logs (keep 10 latest)
5. Run `ls -t .agent/context/context-*.md | tail -n +11 | xargs rm -f 2>/dev/null || true`
6. Save current branch name, then commit all changes
7. Run `DEV_BRANCH=$(git branch --show-current); echo "Saving branch: $DEV_BRANCH"; git add . && git commit -m "session: $DEV_BRANCH $(date +%Y%m%d-%H%M)" || true`
8. Merge dev branch into main
9. Run `DEV_BRANCH=$(git branch --show-current); git checkout main && git pull origin main && git merge $DEV_BRANCH --no-edit`
10. Push main to deploy
11. Run `git push origin main`
12. Create snapshot tag
13. Run `TAG=v$(date +%Y%m%d-%H%M); git tag -a $TAG -m "Session end deploy"; git push origin $TAG`
14. Delete dev branch (cleanup) and stay on main
15. Run `git branch -d $DEV_BRANCH 2>/dev/null || true`
16. Report completion to user — session ended, deployed from main.
