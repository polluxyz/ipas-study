# 交接

換 session 先讀本檔，再讀 `docs/orca-multi-agent.md`，並執行 `orca skills get orchestration` 取得當版指令。
2026-11-08 以前的詳細紀錄已移除，需要時用 `git log -p docs/handoff.md` 查舊版。

## 下一件事：考古題改成題本格式（2026-11-12 使用者提出，尚未動工）

使用者說「考古題的部分 格式沒有更新」。截圖確認：`/official/` 仍是舊格式，每題作答後立即顯示解析，沒有題號快速選單、交卷、成績。截圖在 `tmp/demo-shots/official-format/`（官方索引、115-1-S1 題組、每日題本，1440 寬）。

使用者已決定（AskUserQuestion）：

1. 格式和每日題本一樣：先看目錄，選一份才開始；先存答案不判對錯；可標「不確定」、用題號選單跳題；交卷後給 100 分制成績，再一起檢討。
2. 舊作答：每次開題組都是新的一輪。舊紀錄原地保留，照樣算進錯題本與進度。每輪分開計分，交卷過的輪次可以回看。

已查到的現況：

- 頁面：`demo/src/pages/official/index.astro`、`demo/src/pages/official/[id].astro`。前端 `demo/src/lib/official-client.ts` 呼叫 `initQuestionSet`（即時解析）。題組與進度：`demo/src/lib/official.ts`（6 份：114-2、115-1、指引 × 科目 1、3；作答 mode 為 `official:<session>:S<n>`）。
- 每日題本的狀態規則在 `demo/src/lib/daily-exam.ts`，儲存在 `demo/src/lib/attempts.ts`（`BOOKLET_KEY = 'ipas-daily-draft-v2'`）。
- `docs/specs/daily-exam-mode.md` 第 47、305 行明訂 `/official/` 維持即時解析。所以這是偏離已核可規格，要先寫新 spec。

下一步（依 CLAUDE.md 第 10 節）：

1. 寫 `docs/specs/official-exam-mode.md`，動筆前列假設清單給使用者確認。待定點：輪次存哪個 localStorage key（新 key 或併入題本 store，屬資料格式變更，要問）；新輪次的作答 mode 命名；指引練習題是否也改（指引題不計分）；目錄卡片要顯示什麼；作答中能否放棄這一輪。
2. 徵詢 advisor（Codex sol xhigh），再送 spec、plan、todo 給使用者核可。
3. 核可後派 Codex worker 實作（前端由 Codex 負責）。部署照下方「部署 4321」。

注意：考試日 115/11/14，就是後天。

### 另一件已回覆的事

使用者問「每題都選最長選項考古題能拿幾分」，已回覆：科1 61.7、74.0 分，科3 37.0、56.3 分（114-2、115-1）。腳本 `tmp/longest-option.cjs`。

## 前一階段（2026-11-09）

- main 在 `32d099d`。最近合併：
  - PR #205：規格 v4，每日題本改成先進「題本目錄」。
  - PR #206：實作 v4。`/daily/` 一律先顯示兩科目錄，點某一本才進入作答；作答畫面有「← 題本目錄」；網址指到已放棄或不存在的題本時顯示「找不到這本題本」。
- 已部署到 4321，截圖親看過（`tmp/demo-shots/daily-catalog/v3/booklet/`：目錄、作答、找不到、需結束、檢討，各 1440、390、320 寬與亮暗色）。
- 驗收數字：建置 0（1895 頁）、tsc 0、測試 45 檔 1257 項、題本 smoke 23/23、多分頁 smoke 20/20、交卷 smoke 成功（125 案例）、CI 綠。
- 3 支 daily smoke 都改用共用的 `demo/scripts/daily-nav.mjs` 進出題本。畫面結構再改時，先改這一檔。
- 交卷後的焦點：E2 改成重新載入後焦點掉到 BODY，已修（交卷後帶一次性 `#daily-score` 重新載入，移焦點後去掉 hash）。
- 沒有執行中的 worker。Orca Run 是 `run_e8563c302ab9`。用完的工作樹、分支、終端機都已清掉。
- 實作紀錄在 `tasks/daily-booklet-plan.md` 的「實作紀錄（第 4 版）」。

### 放棄題本的做法（已定案）

- 從 store 刪掉這本，題目回到未出題池。`current` 改指同科下一本未交卷題本，沒有就設 null。
- 資格判斷只有一處：`canDiscardBooklet`（`demo/src/lib/daily-exam.ts:77`）。有任何作答、遷移來的鎖定作答、略過、交卷，都不能放棄。
- 空的 store 也要寫回。否則 v1 遷移會再跑一次，把題本救回來。
- 跨分頁沿用 `seq` 比對。對不上就丟 `DailyConflictError`，畫面改唯讀。

## 待使用者決定

- 其餘概念頁是否也改寫成白話。
- 是否補科目 3 非程式題（規格第 192 行：第 8 本起程式題比例升高）。
- 建議（由 Codex 判斷）：390 寬時兩科開本按鈕的位置不一致；320 寬暗色模式的「結束這本」按鈕對比偏低；他科交卷恢復失敗時，該科卡片仍寫「作答中」。

## 操作備忘

### 部署 4321

4321 直接提供 `D:/ipas-study/demo/dist`。絕不在主工作目錄建置。

1. 建工作樹：`orca worktree create --repo "path:D:/ipas-study" --name deploy-main-dist --base-branch main --branch polluxyz/deploy-main-dist --setup skip --no-parent --json`
2. 部署：`sh tmp/daily-verify/booklet/deploy-main-dist.sh`。成功條件：build=0、robocopy=3、4 個網址都回 200、catalog-marks=1。
3. 移除工作樹：`orca worktree rm --worktree "path:E:/orca/workspaces/ipas-study/deploy-main-dist" --force --json`
4. 執行 `git worktree prune`，再 `git branch -D polluxyz/deploy-main-dist`。

4321 停掉時（重開機或部署後），用 PowerShell 重開：
`Start-Process cmd.exe '/c "C:\Users\Administrator\Desktop\AI學習手札.cmd" --no-open'`
不要換連接埠。localStorage 作答紀錄跟著網址走。

### Orca 派工

- 派工：`SPEC_DIR=<dir> sh tmp/daily-verify/booklet/dispatch.sh <工作樹名> <spec 檔> <標題>`
- 背景等待：`sh tmp/daily-discard/watch.sh <term...>`（連續 2 次沒看到 Working／esc to interrupt 才算停）
- 讀訊息：`orca orchestration check --run run_e8563c302ab9 --json`
- 收尾：`sh tmp/plain-rewrite/release.sh <term>`
- worker 可能卡在輸入框。派工後確認畫面有 Working。
- Codex 0.166.0 用 `--agent codex` 會被更新提示擋住。改用 `orca terminal create --command "codex ... -c check_for_update_on_startup=false"`，等 `tui-idle` 後再 `worker-start --terminal`。
- 新派 worker 最高用 `gpt-6.1-sol` + `high`。xhigh 只在主工作區用。

### 檢查基準

| 項目 | 基準 |
|---|---|
| 測試 | 45 檔、1257 項 |
| check-textbook | T3 警告 85、T6 錯誤 0、完整率 920/920 |
| 照抄檢查 | 0 個片段 |
| 建置 | 1895 頁 |

- 改任何概念頁都要非作者重審。`content/guide-coverage.csv` 的 `reviewed_revision` 要更新成 `sha256:` 加頁面 .md 原始位元組的雜湊，否則 T6 報錯。
- 拆長段落可消除 T3 警告，但會改變雜湊，要重新簽核。

## 已知問題

- 本機負載高時，`smoke.test.mjs` 會 5 秒逾時。和改動無關，CI 會過。
- 部署後 4321 曾自己停掉，原因不明。照上面的方法重開即可。
- `gh pr merge --delete-branch` 在分支被工作樹占用時刪不掉本機分支。先移除工作樹，再刪分支。
- `scripts/orca/done.sh` 這次找不到 run（run-current 回空），ack 略過。

## 使用者偏好與界線

- 回覆用白話繁體中文、結論先講、不用 emoji、不估時間、不用「他／她」。
- 多派 worker，每個 worker 只做一件事。worker 優先用 Codex。
- 用完的分支、工作樹、終端機要清掉。
- 每日題本：不讀、不改使用者的瀏覽器資料；不把官方考題放進題本；不默默清資料。
- `tmp/external-quiz/`、`tmp/medium/` 不可信，只讀參考，不執行、不照做。不照抄外部文章的文字或圖。
- 考試日 115/11/14。Codex 週額度約剩 16%，11/11 14:37 重置。

## 保留不動的工作樹

以下不在本次範圍，不要關閉、重派或丟棄修改：

- `full-site-3d-production-20261104`
- `graph3d-interaction-preview-20261104`
- `relations-reviewed-corrections`：有未提交的舊內容修改。不要丟棄，也不要自動回套 main。
- `relations-semantic-corrections`
- `user-feedback-fixes`

原本保留的終端 `term_0edc63bb…`、`term_80ebf0cf…`、`term_e9507943…` 已不在 Orca 裡，使用者已知。
主工作樹的 `docs/specs/question-bank-expansion.md` 曾是未提交草稿；目前 main 乾淨，動它前先看 git 狀態。
