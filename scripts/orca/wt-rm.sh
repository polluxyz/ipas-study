#!/bin/bash
# PR 合併後清掉寫作組的 worktree 與本機分支。
# `orca worktree rm` 會非同步刪分支；這裡補刪一次以防殘留（已刪就略過）。
# 用法：bash scripts/orca/wt-rm.sh <worktree 路徑>
# 這會丟掉 worktree 內未 commit 的修改。只在 PR 已合併、確認不需要後執行。
ORCA=/c/Users/Administrator/AppData/Local/Programs/orca/resources/bin/orca
P=$1; [ -z "$P" ] && { echo "usage: wt-rm.sh <path>"; exit 1; }
B=$(git -C "$P" branch --show-current 2>/dev/null)
[ -n "$(git -C "$P" status --porcelain 2>/dev/null)" ] && echo "警告：$P 有未 commit 的修改，仍會刪除"
$ORCA worktree rm --worktree "path:$P" --force --json 2>&1 | grep -q '"ok": true' && echo "removed $P"
git worktree prune
[ -n "$B" ] && git branch --list "$B" | grep -q . && { git branch -D "$B" 2>/dev/null && echo "deleted branch $B"; }
exit 0
