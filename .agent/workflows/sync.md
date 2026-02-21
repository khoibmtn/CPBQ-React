---
description: Giữa phiên - Merge vào main, push, deploy, quay lại nhánh tiếp tục
---

// turbo-all

1. Commit all current changes on working branch
2. Run `git add . && git commit -m "wip: $(git branch --show-current) $(date +%H:%M)" || true`
3. Get current branch name for later
4. Run `CURRENT_BRANCH=$(git branch --show-current) && echo "Current branch: $CURRENT_BRANCH"`
5. Switch to main branch and merge
6. Run `git checkout main && git pull origin main && git merge $CURRENT_BRANCH --no-edit`
7. Push main to deploy
8. Run `git push origin main`
9. Create snapshot tag
10. Run `TAG=v$(date +%Y%m%d-%H%M); git tag -a $TAG -m "Sync deploy"; git push origin $TAG`
11. Switch back to working branch to continue development
12. Run `git checkout $CURRENT_BRANCH`
13. Report deploy status to user
