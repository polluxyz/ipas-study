#!/bin/bash
# 派一個 worker：（可選）建 worktree → 開終端機 → worker-start → 確認提示詞真的送出（C1 曾卡在未按 Enter）。
# 用法：bash scripts/orca/dispatch.sh <標題> <spec 檔(逗號分隔可多個)> [search]
# 環境變數：
#   AGENT   codex（預設）｜claude（Opus 5.5 主審）｜gemini（Gemini 4 Argon 主審）
#   MODEL、EFFORT  覆寫模型與推理強度（codex 預設 gpt-6.1-sol／high；claude 預設 effort high）
#   WT      新 worktree 名稱。設了就從 main 開一個獨立 worktree，分支改名為 $BRANCH（預設 content/$WT）。
#           一個寫作組 = 一個 worktree = 一個分支 = 一個 PR（CLAUDE.md 第 13 節）。
#   WTPATH  沿用既有 worktree 的路徑（例如審查者進寫作者的 worktree）。與 WT 擇一。
#   LOG     handle 紀錄檔（預設 tmp/rollout/handles.txt）
# PR 合併後用 scripts/orca/wt-rm.sh <路徑> 清掉 worktree 與本機分支。
ORCA=/c/Users/Administrator/AppData/Local/Programs/orca/resources/bin/orca
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(($1)??'')}catch(e){console.log('')}})"; }
FROM=$($ORCA orchestration run-current --json | jget "j.result.run.coordinator_handle")
LOG=${LOG:-tmp/rollout/handles.txt}
TITLE=$1; SPECS=$2; SEARCH=${3:+--search }
AGENT=${AGENT:-codex}
# Gemini 用完時 tmp/rollout/quota.md 會有一行未解除的標記（docs/orca-multi-agent.md §4）。有標記就不派 Gemini，改用 claude。
QUOTA=D:/ipas-study/tmp/rollout/quota.md
if [ "$AGENT" = gemini ] && [ -f "$QUOTA" ] && grep "gemini 用完" "$QUOTA" | grep -vq "已恢復"; then
  echo "$TITLE: Gemini 標記為用完（$QUOTA），改派 claude"; AGENT=claude
fi

# 決定工作位置：新 worktree、既有 worktree，或主 checkout。
if [ -n "$WT" ]; then
  BRANCH=${BRANCH:-content/$WT}
  WTPATH=$($ORCA worktree create --repo "path:D:\ipas-study" --name "$WT" --setup skip --base-branch main --no-parent --json | jget "j.result.worktree.path")
  [ -z "$WTPATH" ] && { echo "$TITLE worktree create failed"; exit 1; }
  git -C "$WTPATH" branch -m "$BRANCH" || { echo "$TITLE branch rename failed"; exit 1; }
fi
PLACE=${WTPATH:-D:\\ipas-study}

SPEC=""; IFS=',' read -ra F <<< "$SPECS"; for f in "${F[@]}"; do SPEC+="$(cat "$f")"$'\n\n'; done
if [ -n "$WTPATH" ]; then
  SPEC+="## 工作位置（協調者附加）"$'\n'"你的 worktree 是 \`$WTPATH\`，分支 \`$(git -C "$WTPATH" branch --show-current)\`。只在這裡改檔與 commit，不碰 D:\\ipas-study。開工先在 worktree 根目錄跑 \`pnpm --dir demo install --frozen-lockfile\`（套件庫共用，node_modules 各 worktree 獨立）。不要 push、不要開 PR，由協調者處理。"$'\n'
fi

if [ "$AGENT" != codex ]; then
  # Claude／Gemini：worker-start 自己開終端機（docs/orca-multi-agent.md 的一行派法）。
  case $AGENT in
    claude) AG="--agent claude --model ${MODEL:-claude-opus-5-5} --effort ${EFFORT:-high}" ;;
    gemini) AG="--agent antigravity --model ${MODEL:-gemini-4-argon-high}" ;;
    *) echo "unknown AGENT $AGENT"; exit 1 ;;
  esac
  R=$($ORCA orchestration worker-start --spec "$SPEC" $AG --worktree "path:$PLACE" --from $FROM --json 2>&1)
  D=$(echo "$R" | grep -o '"dispatchId": *"[^"]*"' | head -1 | sed 's/.*"\(ctx_[^"]*\)"/\1/')
  H=$(echo "$R" | grep -o '"term_[^"]*"' | head -1 | tr -d '"')
  [ -z "$D" ] && { echo "$TITLE worker-start failed"; echo "$R" | head -30; exit 1; }
  echo "$TITLE ${H:-?} $D started${WTPATH:+ $WTPATH}" | tee -a "$LOG"
  exit 0
fi

CMD="codex ${SEARCH}--dangerously-bypass-approvals-and-sandbox -m ${MODEL:-gpt-6.1-sol} -c model_reasoning_effort=${EFFORT:-high} -c check_for_update_on_startup=false"
H=$($ORCA terminal create --worktree "path:$PLACE" --title "$TITLE" --command "$CMD" --json | jget "j.result?.terminal?.handle||j.result?.handle")
[ -z "$H" ] && { echo "create failed"; exit 1; }
$ORCA terminal wait --terminal "$H" --for tui-idle --timeout-ms 90000 --json >/dev/null 2>&1
R=$($ORCA orchestration worker-start --spec "$SPEC" --terminal "$H" --worktree "path:$PLACE" --from $FROM --json 2>&1)
D=$(echo "$R" | grep -o '"dispatchId": *"[^"]*"' | head -1 | sed 's/.*"\(ctx_[^"]*\)"/\1/')
[ -z "$D" ] && { echo "$TITLE $H worker-start failed"; echo "$R" | head -30; exit 1; }
# 確認開工：畫面還留著 [Pasted Content 就補 Enter，最多 3 次。
for i in 1 2 3; do
  sleep 4
  SCREEN=$($ORCA terminal read --terminal "$H" --json 2>/dev/null)
  echo "$SCREEN" | grep -q "Working" && break
  echo "$SCREEN" | grep -q "Pasted Content" && $ORCA terminal send --terminal "$H" --enter --json >/dev/null 2>&1
done
STATE=$(echo "$SCREEN" | grep -q "Working" && echo working || echo UNCONFIRMED)
echo "$TITLE $H $D $STATE${WTPATH:+ $WTPATH}" | tee -a "$LOG"
