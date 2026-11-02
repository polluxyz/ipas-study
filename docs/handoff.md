# 交接：同名公開遷移與全站寫作波

本頁記錄穩定決策及接手方式；即時狀態以本機 `tmp/migration/control.json`、`tmp/scratch/coordinator-current-state.json`、Orca 與 GitHub 實際回應為準。原始 API、備份與私人身分資料不進版控。

## 接手位置

- 新的正式工作根目錄是 **`D:/ipas-study`**。正式 GitHub 名稱為 **`polluxyz/ipas-study`**；新 GitHub node ID 必須是 **`R_kgDOVfp2dg`**。
- 舊本機 `D:/AI_test` 與原工作樹只作私有備份。舊 GitHub node ID `R_kgDOVev-fQ`；使用者已指定：新庫驗收後刪除舊 GitHub repo，最後只留一個同名公開 repo。本機備份保留，不能把舊歷史搬回新庫。
- 新 Orca repo ID 從 `orca repo show --repo path:D:/ipas-study --json` 的實際輸出取得；它與舊 ID 不同。worker／worktree 明傳新 repo ID 或精確完整 selector，不靠同名 UI 分組或舊 current 推測。
- Run 沿用 **`run_0668a2365727`**。先 `orca orchestration run-use --id run_0668a2365727 --json`，核對自己的 coordinator handle，再讀信及 worker-list。
- Windows 腳本使用 **`C:/Program Files/Git/bin/bash.exe`**；PATH 的 bash 指向 WSL。新專案腳本及 tmp 協調工具使用新根目錄。

## 公開遷移界線

2026-11-02 使用者指定「只留一個 repo、搬移後刪舊、名稱仍為 ipas-study」，不再重問這三項。規格、計畫、任務為 `docs/specs/public-migration.md`、`tasks/public-migration-plan.md`、`tasks/public-migration-todo.md`。

- 新歷史從已驗收的 tracked 快照開始；原始 PDF、text、教材 ID、官方答案與教材內容保持位元組一致。舊 author、committer、提交訊息、PR、Actions 都有個人 email，不能只改作者顯示或直接 mirror。
- Git 使用 GitHub noreply；仍須檢查新 clone／worktree 的有效設定與環境覆寫，push 前掃完整訊息，squash 後查 main／Actions。
- 新庫先 private 驗收，再取得正式名稱、公開及匿名驗證，最後以舊庫精確名稱和 node ID 刪除。`tmp/migration/control.json` 保存實際階段與收據；不能重做已完成的建庫、改名或刪庫。
- 私有備份在本機 `D:/private-backups/ipas-study-20261102/`，含 bundle、逐分支 patch、可取得 GitHub metadata、logs 與 tmp 審查資料。不公開提交，不未經核可刪除。
- 不新增依賴、不修改 workflows、不部署網站；部署仍需另行核可。

## 全站寫作現況與恢復次序

`tasks/full-site-plan.md` v3；分組表在本機 `tmp/rollout/merged/v1/writing-groups.csv`，全站 85 組。

- 舊庫最後 PR #98 合併後，共 **73 組**在 main；遷移文件為舊庫 PR #97。原六組 queue 全完成，不可重跑原清單。
- **12 組交稿尚未合併**，由本機檔案差異重建新歷史分支，不 fetch／merge／cherry-pick 舊分支：W-L23302-B、W-L23304-B、W-L21102-C、W-L21102-D、W-L21103-B、W-L21103-E、W-L21104-B、W-L21302-B、W-L23401-G、W-L23402-C、W-L21101-E、W-L21103-D。
- 原十組已由協調者重跑檢查、230 項測試、照抄與建置驗收；RV 十組完成。CK 六組完成：W-L23402-C、W-L23401-G、W-L23304-B、W-L21102-D、W-L23302-B、W-L21103-E。
- **下一波 CK**：W-L21302-B、W-L21103-B、W-L21102-C、W-L21104-B。最後兩組完成協調者驗收後派 RV／CK。
- W-L23402-C 的 FX 完成，下一步 RR；其餘收到 RV＋CK 的組別先 FX。必須讀完整 review-main／review-calc 並補足 partial，不能以「0 錯誤」省略深度缺口。
- W-L23402-C 重建時保留乾淨 writer／FX 兩個新提交供 RR 比較。實際 worktree／commit 對照在本機遷移清單；舊 metadata 不進公開庫。
- 新整合重跑協調者驗收與 CI；舊審查只沿用內容雜湊相同的部分，衝突與新差異重審。reviewed_revision 是教材內容 SHA-256，不是 Git commit SHA。

流程：writer → verify-group → RV（Claude）＋CK（非作者 Codex）→ FX → RR（必要時 FX2／RR3）→ CK2 → coverage → PR／CI／squash。

## 角色、額度與工具

- 協調者 Codex gpt-6.1-sol／xhigh；生產與修正 Codex high；審查／核算／advisor Codex xhigh。Claude 只做內容主審 claude-opus-5-5／medium。
- 同時上限 Codex 10、Claude 6；派前查 account list 與 worker-list。帳號與用量留本機，不寫公開文件。Gemini 暫不可用，查本機 quota 標記。
- 只用 Orca 派工，五欄 Task、擁有權與驗收照 `docs/orca-multi-agent.md`。驗收後 release、關終端機，再 ack delivery ID。
- `tmp/rollout/coord/` 是本機工具，含 verify、dispatch、merge-coverage、merge-ci、ship、land、queue；從私有資料恢復後核對新根目錄與 repo ID，不複製舊 .git。
- 舊 land-pr 在 head 更新、checks 為空時曾提前合併。修正版要求非空 checks 全 SUCCESS、head SHA 不變、merge 帶 --match-head-commit；不能只看「沒有 fail」。
- verify-group 若只有現成 writer-report，可能在全部檢查通過後 exit 1；核對 Complete／230 tests／0 errors／照抄0／options PASS，不為退出碼反覆重跑。
- PowerShell 5 的 ps1 使用 UTF-8 BOM；含中文程式不要經預設編碼管線傳給 Node。CSV 用 Node 並保留換行。

## 內容待辦與既有問題

- M4 與剩餘建議在本機 `tmp/rollout/m4-backlog.md`：AutoML 17 行程式 T3、術語一致性、深色對比與 pending 公式直接來源。
- 合併後補 densenet／cnn-architectures／efficient-cnn → cnn 的既定關係；pair-counts 仍 pending。
- W-L21104-B 重跑設 IPAS_REPO_ROOT；W-L21103-E 設 IPAS_EXAMPLE_FILE。Python 暫可沿用舊本機實測環境，Task 要明寫，不能誤指新根下不存在的 .venv。
- 待使用者決定：正式 site-v1 規格／計畫／todo、正式網站套件、詞表提案。公開不代表部署或擴大網站範圍。
- 11/03 前回報完工區間；考試 11/14，品質門檻維持，必要取捨交使用者決定。

使用者偏好：答案正確第一、兩科完成、前端交 Codex、例子跨領域；工作單位完成就更新交接換 session，但不能丟下 worker／delivery／背景作業。
