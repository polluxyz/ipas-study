# 交接：公開遷移完成，接續全站寫作波

本頁記錄穩定決策及接手方式；即時狀態以本機 `tmp/migration/control.json`、`tmp/scratch/coordinator-current-state.json`、Orca 與 GitHub 實際回應為準。原始 API、備份與私人身分資料不進版控。

## 接手位置

- 新的正式工作根目錄是 **`D:/ipas-study`**。正式 GitHub 名稱為 **`polluxyz/ipas-study`**；新 GitHub node ID 必須是 **`R_kgDOVfp2dg`**。
- 舊本機 `D:/AI_test` 與原工作樹只作私有備份。舊 GitHub node ID `R_kgDOVev-fQ`；使用者已指定：新庫驗收後刪除舊 GitHub repo，最後只留一個同名公開 repo。本機備份保留，不能把舊歷史搬回新庫。
- **遷移已完成**：唯一公開庫為 `polluxyz/ipas-study`，新 node ID 正確；匿名 clone 與候選相同，舊 GitHub repo 已刪除（204，舊 numeric ID 查詢 404）。不要重跑建庫、改名或刪舊；驗收見 `docs/public-migration-verification.md`。
- 新 Orca repo ID 是 **`555621aa-2814-4352-83be-7ccb05ac7de4`**。worker／worktree 明傳新 repo ID 或精確完整 selector，不靠同名 UI 分組或舊 current 推測；Orca 的 cached remote identity 可能仍顯示 staging 暫名，以實際 Git remote 及 GitHub node ID 為準，不改底層資料庫。
- Run 沿用 **`run_0668a2365727`**。先 `orca orchestration run-use --id run_0668a2365727 --json`，核對自己的 coordinator handle，再讀信及 worker-list。
- Windows 腳本使用 **`C:/Program Files/Git/bin/bash.exe`**；PATH 的 bash 指向 WSL。新專案腳本及 tmp 協調工具使用新根目錄。
- **使用者最新指示：整個資料夾作業都遷過來，舊的關掉。** 已補齊本機工作檔、建立新 `tools/python/.venv`（原鎖檔 138 套件）、搬妥 `tmp/pdf_runtime`，新環境 13 個套件及 PDF runtime 匯入通過。後續不得使用舊根的 Python 或協調工具。
- 預覽已改在新根，`http://127.0.0.1:4321/` HTTP 200；常駐終端 `term_97348002-6cab-4bb8-bec6-aded72eae95d` 勿關。舊根及工作樹的其他 17 個終端已關；最後舊協調者要由新協調者接手 Run 後關閉，並移除舊 setup `570d4390-9695-4278-96b3-3d05d3962a51` 的 Orca 登錄，本機檔案只留離線備份。

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
- 12 組 writer、RV、CK、FX 均完成。已送新庫 PR：#3 W-L23402-C、#4 W-L21102-D、#5 W-L21103-E、#6 W-L23401-G；都跑過協調者 230 項測試、教材／照抄檢查及建置，push guard 敏感命中 0。合併前仍須各自 CI 全綠；#5 曾出現 checks 空集合，必須調查並取得實際成功 CI，不能直接合併。
- **接手第一步**：綁定 Run、確認新環境與預覽、關閉舊協調者／舊 setup，再立即補上工作波：FX2（W-L21302-B、W-L21103-B、W-L21104-B），RR（W-L21103-D），CK2（W-L21102-C、W-L23302-B）。目前完成 worker 已收尾；讀本機最新 state 與 handles 確認沒有新完成事件漏處理。
- RR／RR3 通過待整合：W-L21101-E（7 列）、W-L23302-B（12 列、PDP 仍 pending）、W-L21102-C（9 列、AP/mAP 兩群 pending）、W-L23304-B（7 列、兩個推導計數式仍 pending）。W-L23401-G 的 CK2 已確認，可改 verified，協調者已簽核並以 rehash 併入 PR #6。
- W-L23304-B CK2 數字 79/79、程式 3/3，但兩個指定來源沒有直接列式，0/2 群可改 verified；不能憑「推導正確」繞過來源門檻。後續補直接來源再複核，或如實保留 pending，不稱全數簽核完成。
- 必須讀完整 review-main／review-calc 並補足 partial，不能以「0 錯誤」省略深度缺口。所有 worker 已改在新庫工作，切換完成後恢復正常新庫 PR，仍禁止引入舊歷史。
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
- W-L21104-B 重跑設 IPAS_REPO_ROOT；W-L21103-E 設 IPAS_EXAMPLE_FILE。Python 統一 `UV_PROJECT_ENVIRONMENT=D:/ipas-study/tools/python/.venv`、`UV_NO_SYNC=1`；PDF runtime 統一 `D:/ipas-study/tmp/pdf_runtime`，兩者已建妥。
- 待使用者決定：正式 site-v1 規格／計畫／todo、正式網站套件、詞表提案。公開不代表部署或擴大網站範圍。
- 11/03 前回報完工區間；考試 11/14，品質門檻維持，必要取捨交使用者決定。

使用者偏好：答案正確第一、兩科完成、前端交 Codex、例子跨領域；工作單位完成就更新交接換 session，但不能丟下 worker／delivery／背景作業。
