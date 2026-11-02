# Orca 多代理派工、交接與省 token

`CLAUDE.md` 第 13 節是入口，細節只記在這裡。改編自 `D:\Projects\pollux\docs\orca-multi-agent.md`（§4、§5 的踩坑紀錄仍可參考）。

## 1. 角色表（換模型只改這裡）

**worker 優先用 Codex**（2026-11-01 使用者要求）。**推理強度**（2026-11-02 使用者要求）：生產工作（寫作、修正、網站、抽取）用 `gpt-6.1-sol` + `high`；審查、核算、建議類的 Codex 工作用 `xhigh`。Claude 主審維持 `--effort medium`。只有真的需要時才派非 Codex：審查 Codex 寫的內容（避免同一個 provider 自己審自己），或 Codex 做不好的工作（派工單寫明理由）。

| 角色 | 啟動方式 | 用在 |
|---|---|---|
| `coordinator` | Codex 兩段式，`gpt-6.1-sol` + `xhigh`（2026-11-02 起，取代 Claude Code） | 規劃、派工、驗收、送 PR、合併、交接 |
| `site` | Codex 兩段式，`gpt-6.1-sol` + `high` | 網站程式、檢查器、需要判斷的資料工作 |
| `extract` | Codex 兩段式，`gpt-6.1-sol` + `high` | 單純的題目抽取、圖片產生 |
| `writer` | Codex 兩段式，`gpt-6.1-sol` + `high`，加 `--search`（上網查資料） | 概念頁、題目解析、模擬題、讀 PDF 圖片轉錄 |
| `reviewer-claude` | 一行，`--agent claude --model claude-opus-5-5 --effort medium` | 主審 Codex 寫的內容（Claude Code 的唯一角色） |
| `reviewer-gemini` | 一行，`--agent antigravity --model gemini-4-argon-high` | 主審 Codex 寫的內容（與 `reviewer-claude` 分攤） |
| `reviewer` | Codex 兩段式，`gpt-6.1-sol` + `xhigh`，加 `--search` | 盲解、審查 Claude 寫的內容、程式與工具審查 |
| `advisor` | Codex 兩段式，`gpt-6.1-sol` + `xhigh` | 要使用者拍板的決策的第二意見 |

## 2. 派工指令

Codex 兩段式：

```bash
ORCA=/c/Users/Administrator/AppData/Local/Programs/orca/resources/bin/orca
H=$($ORCA terminal create --worktree "path:D:\\ipas-study" --title "<任務代號>" \
  --command "codex --dangerously-bypass-approvals-and-sandbox -m gpt-6.1-sol -c model_reasoning_effort=high -c check_for_update_on_startup=false" --json | <取 handle>)
$ORCA orchestration worker-start --spec "$(cat <task spec 檔>)" --terminal "$H" --worktree "path:D:\\ipas-study" --from <協調者 handle> --json
```

- 要上網就在 `codex` 後面加 `--search`。
- 派工後讀一次畫面。看到 `[Pasted Content N chars]`（可能換行顯示成兩行）就補送 `orca terminal send --terminal <handle> --enter`，再確認出現 `Working`。

Claude 一行：`worker-start --spec ... --agent claude --model claude-opus-5-5 --effort medium --worktree ... --from ...`。

Gemini 一行：`worker-start --spec ... --agent antigravity --model gemini-4-argon-high --worktree ... --from ...`。啟動遇到 503 或 `agent_unconfigured` 就關掉終端機重開。release 後的 Antigravity 終端機不能再派任務。

Task spec 檔放 `tmp/<工作>/specs/`。

### 2.1 用腳本派工（建議）

`scripts/orca/dispatch.sh` 包了上面三種派法，並處理補 Enter 與 handle 紀錄。

```bash
# 寫作組：開新 worktree（從 main，分支改名為 content/<名>），派 Codex
WT=w-l23102-a bash scripts/orca/dispatch.sh "W-L23102-A" <spec 檔>
# 審查：進寫作者的 worktree，派 Opus 5.5（effort medium）或 Gemini 4 Argon
WTPATH=<worktree 路徑> AGENT=claude EFFORT=medium bash scripts/orca/dispatch.sh "R-L23102-A" <spec 檔>
WTPATH=<worktree 路徑> AGENT=gemini bash scripts/orca/dispatch.sh "R-L23102-A" <spec 檔>
```

- worktree 建在 `E:/orca/workspaces/ipas-study/<名>`（E: 是 Dev Drive）。2026-11-02 已從舊根完整遷移，舊 `AI_test` 工作樹僅留本機離線備份；活動工作統一新 repo ID `555621aa-2814-4352-83be-7ccb05ac7de4`。協調腳本用 `tmp/rollout/coord/wtpath.sh` 從 `git worktree list` 查路徑，不寫死。腳本會在 spec 末尾附上路徑、分支，並要求 worker 先跑 `pnpm --dir demo install --frozen-lockfile`、不 push。
- 套件管理用 pnpm（2026-11-01 改用）。所有 worktree 共用 `E:.pnpm-store`（內容定址的套件庫），各 worktree 的 `node_modules` 用硬連結指向它，仍各自獨立。目的是減少重複檔案，降低 Defender 掃描負擔。
- push、開 PR、合併由協調者做。PR 合併後執行 `bash scripts/orca/wt-rm.sh <worktree 路徑>`，清掉 worktree 與本機分支。這會丟掉未 commit 的修改。

## 3. 等待與收尾

- 等待：`node scripts/orca/wait.cjs`（背景執行）。heartbeat 自動 ack；遇到 worker_done、question、escalation 就印出並結束，不 ack。
- 收尾：驗收通過後 `bash scripts/orca/done.sh <dispatchId> <deliveryId>`，依序 release、關終端機、ack。
- 使用者看到「You have N orchestration messages」時，多半是 heartbeat 或 status，讀完 ack 即可。

## 4. 額度

- 同時執行上限：Codex 10 個、Claude 6 個。每次派工前跑 `orca account list --json`。
- 審查原則：寫的人和審的人用不同 provider。Codex 寫的內容由 `reviewer-claude`（Opus 5.5）或 `reviewer-gemini`（Gemini 4 Argon）主審，不用 Sonnet；公式獨立核算與程式實測另派非作者 Codex `reviewer`。Claude 寫的內容由 Codex `reviewer` 審（使用者 2026-11-01 核可混合審查）。
- Claude 的 5 小時 `session` 用量超過 80% 時，暫停派 Claude，主審改派 `reviewer-gemini`。兩者都不可用時才改用另一個 Codex session，並在報告註明。
- **Gemini 用量用完要做標記**（2026-11-02 使用者要求）。Gemini 終端機出現額度錯誤（例如 `429`、`RESOURCE_EXHAUSTED`、`quota`、usage limit）時：
  1. 在 `tmp/rollout/quota.md` 加一行：`- <日期 時間> gemini 用完｜恢復：<畫面寫的時間，沒寫就填「未知」>｜受影響：<任務代號> → 改派 <agent>`。
  2. 該任務改派 `reviewer-claude`；Claude 也不可用才改派 Codex。改派寫進 handles.txt，PR 描述的審查欄註明「Gemini 用完，改由 ○○ 主審」。
  3. 標記期間 `dispatch.sh` 會擋下 `AGENT=gemini`。確認恢復後，在該行末尾加「｜已恢復 <時間>」解除。

## 5. Session 交接

長 session 每輪都重送整段對話，是 token 的最大宗（pollux 實測：context 超過 30 萬的 session 占快取讀取 92%）。所以協調者做完一件事就換新 session，不等 context 滿。

### 5.1 什麼時候換

- **觸發**：一個完整工作單位做完，例如一組概念頁改寫並驗收、或使用者交代的一項修正完成。
- **共同門檻**，全部成立才換：沒有進行中的 worker、待處理的 Delivery 或背景作業；使用者的要求都處理完；沒有只存在對話裡、還沒寫下的狀態。
- **context 過大**：超過約 12–13 萬 token 時，先把重點寫進 plan 與 handoff，到下一個符合門檻的時間點再換。不要為了換 session 丟下進行中的 Run。

### 5.2 舊 session

1. 更新 `docs/handoff.md`（上限 8,000 字，只寫現況、下一步、使用者偏好、已知問題）。執行紀錄寫進該工作的 `tasks/<工作>-plan.md`，長期規則寫進 `CLAUDE.md` 或規格。
2. 有 Run 時：ack 處理完的 Delivery，再發交接信 `orca orchestration send --to run:<run_id> --subject "handoff" --body "..." --json`。交接信只寫 Orca 查不到的東西：決策與理由、試過但失敗的做法、使用者當場給的偏好、沒寫進 Task spec 的前提。
3. 停手，不再改檔案。新 session 由使用者開，或依 5.4 由舊 session 開。

### 5.3 新 session

第一件事讀 `docs/handoff.md`，只讀它指到、目前工作需要的檔案。有 Run 時：

```bash
orca orchestration run-use --id <run_id> --json      # coordinator_handle 要是自己、consumer_generation 要加 1
orca orchestration check --json                      # 回應要有 runId，沒有代表沒綁上
orca orchestration worker-list --run <run_id> --json
```

### 5.4 由舊 session 開新 session

1. `orca terminal create --worktree "path:D:\\ipas-study" --title "協調者" --command "codex --dangerously-bypass-approvals-and-sandbox -m gpt-6.1-sol -c model_reasoning_effort=xhigh -c check_for_update_on_startup=false" --json`（中文提示不要塞進 `--command`）。
2. `orca terminal wait --terminal <新 handle> --for tui-idle --timeout-ms 120000 --json`。
3. `orca terminal send --terminal <新 handle> --text "讀 docs/handoff.md，接手。先唯讀確認下一步與待核可事項，回報後等使用者指示。" --enter --wait-submit 30 --json`。
4. 報告新舊 handle 與 `orca terminal close --terminal <舊 handle>`，由使用者關舊分頁。舊 session 不自己關自己。

## 6. 省 token

- `.claude/settings.json`：`autoCompactWindow: 150000`（15 萬 token 就壓縮）。壓縮後 SessionStart hook（`.claude/hooks/compact-status.mjs`）會印出 Orca Run 與進行中的 worker，精確 ID 以 hook 輸出為準，不靠摘要。
- `.claude/settings.local.json`：關掉 claude.ai 技能同步、連接器、Artifact（本專案用不到）。
- `CLAUDE.md` 上限 11,000 字，`docs/handoff.md` 上限 8,000 字。細節放權威文件，只留入口。
- 協調者省 token 的習慣：
  - 讀檔只讀需要的行。
  - 大量輸出用 `grep`／`head` 篩過再看。
  - 等待用背景 `wait.cjs`，不要重複輪詢。
  - 驗收看 worker 回報與檢查器結果，不整份重讀。
- 實作派給 Codex，也同時省下 Claude 的額度。
