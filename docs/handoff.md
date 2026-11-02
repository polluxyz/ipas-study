# 交接：學習網站

最後更新：2026-11-02，同名公開遷移決策後。**上限 8,000 字**，只寫現況、下一步、使用者偏好、已知問題。派工與交接規則在 `docs/orca-multi-agent.md`。接手時先讀本檔。

## 角色分工（2026-11-02 使用者決定）

- **協調者改由 Codex 擔任**（`gpt-6.1-sol` + `xhigh`）：規劃、派工、驗收、送 PR、合併、交接。
- **Claude Code 只做內容主審**（RV、RR、RR3，`claude-opus-5-5`，`--effort medium`），由協調者用 Orca 派。Claude 不再當協調者。
- 寫作、修正（FX/FX2）、核算（CK/CK2）照舊派 Codex worker。

## 接手第一步

1. `$ORCA orchestration run-use --id run_0668a2365727 --json`（`coordinator_handle` 要變成自己）。`scripts/orca/dispatch.sh` 從 run-current 取協調者 handle，綁好後腳本不用改。
2. `$ORCA orchestration check --peek --json` 看積壓訊息；`worker-list --run run_0668a2365727 --json` 看 worker。
3. 先讀 `tmp/scratch/coordinator-current-state.json` 並核對 queue 與派工腳本是否仍執行；同時只能有一個 queue。Windows 必須用 `C:/Program Files/Git/bin/bash.exe`，PATH 上的 bash 指向 WSL。

## 現況：全站寫作波（85 組）

- 計畫 `tasks/full-site-plan.md` v3。分組表 `tmp/rollout/merged/v1/writing-groups.csv`。截至 PR #94，main 已合併 70 組；最新以 GitHub／queue 與本機狀態檔為準。
- 每組流程：writer → `verify-group.sh` 驗收 → RV 主審（Claude）＋CK 核算（Codex）→ FX 修正 → RR 複核（有錯就 FX2 再 RR3）→ pending 公式群派 CK2 → `set-verified.mjs` → 排合併佇列。
- 同時上限：Codex 10、Claude 6。派之前先數空位。

### 合併佇列

- 接手協調者已啟動 `tmp/scratch/queue-rest.txt`；執行 session 31699。PR #92（W-L21302-F）、#93（W-L23304-C）、#94（W-L23203-H）已合併，#95（W-L23203-E）CI 中；後續 W-L21102-B、W-L23202-E。
- 清單包含已處理的首列，執行中不得改寫清單或重開 queue。若 queue 停下，先核對實際已合併項目，再產生新的剩餘清單。
  - 執行：`bash tmp/rollout/coord/queue.sh tmp/scratch/queue-rest.txt`。用背景執行，一次只能跑一個 queue.sh。
  - rehash 欄用逗號分隔（`ship-group.sh` 用 `${RH//,/ }` 切）。
  - 印 `STOP:` 就停：看原因，修好後刪掉已完成列再重跑。`guide-coverage.csv` 衝突：`git checkout --theirs` 該檔，重跑 merge-coverage 與 merge-ci。

### 已交稿與審查中（10 組，2026-11-02 原 10:30 寫作波）

W-L23302-B、W-L23304-B、W-L21102-C、W-L21102-D、W-L21103-B、W-L21103-E、W-L21104-B、W-L21302-B、W-L23401-G、W-L23402-C。

- 十組都已由協調者重跑檢查、230 項測試、照抄及建置驗收；原 writer 已 release／關閉。W-L23302-B 保留作者已揭露的 AutoML 程式 17 行 T3 警告，交主審判斷。
- 六組 RV＋CK 第一波由 `tmp/scratch/start-review-wave.sh` 啟動：W-L23402-C、W-L23401-G、W-L23304-B、W-L21102-D、W-L23302-B、W-L21103-E。腳本可能尚未派完，先讀 handles 與實際 worker-list，避免重派。
- 其餘四組 W-L21302-B、W-L21103-B、W-L21102-C、W-L21104-B 待空位派 RV／CK。W-L21104-B 重跑程式需設 `IPAS_REPO_ROOT` 指向該 worktree。
- `verify-group.sh` 若最後只找到現成 writer-report.md，可能在全部檢查通過後以 exit 1 結束；已獨立核對各組 Complete、230 tests、0 errors、照抄0、options PASS，沒有重跑去湊 exit code。

### 最後兩組寫作

W-L23203-H 已合併，`tmp/scratch/start-last-writers.sh` 正在依序派 W-L21101-E、W-L21103-D。先核對 handles 與 worker-list，確認是否已派，不可重派。

## 公開 repo 任務（最新使用者決定，已授權執行）

**只留一個 `polluxyz/ipas-study`；先搬到乾淨的新庫，驗收、切換與公開後刪除舊 GitHub repo。** 這取代前次「永久保留舊 private repo、另用 ipas-study-public」的提案，不再為公開、刪舊與最終名稱重問。

- 規格 `docs/specs/public-migration.md`；計畫／任務 `tasks/public-migration-plan.md`、`tasks/public-migration-todo.md`。
- 前次 advisor 報告 `tmp/advisor/public-repo.md`；依最新決定的同名與刪舊順序複核 `tmp/advisor/public-repo-single.md`。
- 舊庫目前 PRIVATE。舊 node ID `R_kgDOVev-fQ`；rename、public、delete 前都須核對新舊 node ID，不能只看同名 URL。
- 個人 email 不只在 author／committer，也在幾乎全部 squash 訊息、PR commits 與 Actions metadata。只改 main 作者不夠。一般 push 不能改 PR refs；Support 特定情形可協助清除，不能寫成「永久無法刪除」。
- 共用本機 `user.email` 已設 GitHub noreply；歷史仍待隔離，不能把此設定當成已清理舊資料。
- 舊 Git bundle、未合併分支 patch、管理資料與 tmp 審查證據只留本機，不另留第二個 GitHub repo、不進公開庫。原始 PDF、text 與教材位元組保持一致。
- 新庫先用唯一暫名、private 狀態驗收；乾淨快照新歷史，不 fork、不 mirror、不 merge 舊史。CI 與 fresh clone／隱私掃描通過後才切換到同名並公開，最後刪除已更名的舊庫。
- `gh` token 已有 delete_repo 權限；沒有為此增加權限。既有 workflows 不改，不新增工具相依；網站部署仍另案核可。
- 實際切換前須讓網路 push／merge 到自然邊界，保全未合併成果，核對 Orca 註冊與工作樹；不因遷移丟下或刪掉內容。

## 協調者腳本（`tmp/rollout/coord/`）

- `verify-group.sh <組>`：看 `out-of-scope`、`errors-any`、照抄、option-length、Tests、Complete。
- `dispatch-writer/review/fix/fix2/rereview/rr3/ck2.sh`；review 可加 `ONLY=rv` 或 `ONLY=ck`。RR3 也可手寫 spec，照 `tmp/rollout/specs/RR3-W-L21102-B.md` 格式。
- `set-verified.mjs <wt> codex-gpt-6.1-sol:CK2-<組> <頁>:<群> ...`，改完 commit，排佇列時 rehash 這些頁。
- `queue.sh <清單> [先等的 PR]`：每行 `G|組|英文標題|英文摘要|rehash ids|取代備註|backlog`。`land-pr.sh <PR> <組> "<backlog>"` 合併並收尾。
- `ready-groups.mjs`：列出可派的寫作組。
- 讀訊息：`check --run run_0668a2365727 --json > tmp/scratch/chk.json`，取 `result.deliveryId`。**ack 用 deliveryId，不用 msg id**。
- 收尾：`bash scripts/orca/done.sh <ctx> none run_0668a2365727`，再 `sed -i "/<ctx>/s/ \(working\|started\) / done /" tmp/rollout/handles.txt`。

## 額度

- Codex：CaseyJu3962 使用中（11/02 約 3%，週三 19:56 重置）。rowanhu7832 已 91%（11/04 重置）。verona.moore 備用。快用完時請使用者在 Orca 介面切帳號，不用重置券。
- Claude：週額度約 80%（週四 11:59 重置）。主審只派 Claude，省著用；session 用量超過 80% 時暫停派。
- Gemini：不可用（OAuth disabled），標記在 `tmp/rollout/quota.md`，預計 11/07 恢復。標記期間 `dispatch.sh` 會擋 `AGENT=gemini`。

## 協調者待辦（不擋寫作）

- M4 補強：`tmp/rollout/m4-backlog.md`（RR 剩餘建議、T3 警告、「摺／折」混用、demo 深色模式對比）。
- 合併後補關係：densenet、cnn-architectures、efficient-cnn → cnn 的 is_a／part_of（W-L23203-E）。
- pending 公式群補直接來源（清單在 m4-backlog）。pair-counts（W-L23203-H）維持 pending。
- **產能**：85 組合併 67 組，考試 11/14。最遲 11/03 向使用者回報完工區間與取捨。

## 待使用者決定

1. site-v1 規格、計畫、任務清單（`docs/specs/site-v1.md`、`tasks/site-v1-plan.md`、`tasks/site-v1-todo.md`）。
2. 正式網站套件：astro、@astrojs/starlight、yaml、csv-parse、Vitest、Playwright。
3. 詞表提案用詞（SVM、log-odds、樸素貝氏），批次決定。

## 使用者偏好

- agent 一律用 Orca 開。教材全由 Codex 寫；Codex 生產 high，Codex 審查／核算／建議 xhigh，Claude 主審 medium。
- 品質維持最高標準，多 agent 平行，科目 1、3 都要完成。概念目錄照指引順序（PR #84）。
- 完成的 worker 驗收後就 release 並關終端機。做完一件事就換 session。
- 前端設計與實作由 Codex 全權負責。教材例子分散不同領域、補充內容低調標示。

## 環境與已知問題

- `ORCA=/c/Users/Administrator/AppData/Local/Programs/orca/resources/bin/orca`。舊協調者 term_83ba0a92-87b1-479d-86a6-ee45f6938ca6。
- 前景指令不要加 `&`。Git Bash 沒有 pkill；清殘留程序用 PowerShell `Get-CimInstance Win32_Process`。
- 改 CSV 用 node，不用 sed（CRLF 會變 LF）。bash 雙引號裡不要放反引號，用 heredoc 寫到 `tmp/scratch/`。
- 讀 PDF 改讀 `pdf-pages/` 的 PNG。指引印刷頁 5-N 對應 `pdf-pages/guide3_<134+N>.png`。
- 區塊公式的 `$$` 必須獨立成行（T4 會擋）。程式實測：`node scripts/tools/run-code.mjs <概念頁> --out <報告>`。
