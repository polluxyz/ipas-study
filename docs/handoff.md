# 全站教材交接

此文件是 2026-11-03 驗收中的快照。正式根目錄為 `D:/ipas-study`；受測產品 main 為 `85769e8b0e718aa12baca800a8be44b116837bc4`，不是 PR #68 時的 `5dd99a8`。狀態可能繼續變動，接手先查 `tmp/scratch/continuation-20261103-current.md`、`tmp/scratch/coordinator-current-state.json`，再以實際 Git、Orca CLI 和各階段 JSON 收據核對；暫存紀錄也可能落後。已核可工作持續執行，不因 context 壓縮停止或重問是否繼續；舊工作區關閉及遷移已完成。

## 已整合與驗收現況

- PR #69–#78 已合併。85／85 寫作組、485 個概念、200 題考古題與 1 題既有模擬題已整合；920／920 學習目標有涵蓋，976 個有效映射列為 947 complete、29 partial；21／21 學習路線及 21／21 速查已整合。這些數字不等於全站驗收完成。
- 148 頁 owner-first 修正只改 metadata，以非作者證據沿用既有簽章並保留原 reviewer 與 note，並非重新語意審查。公式 pending 及其直接來源門檻不變，partial 不自行升級。
- 候選 D 位於 `tmp/rollout/final-browser-20261103-d/`，有對應產品 SHA 的 `source.json` 和 `receipt.json`。協調者在該版取得 359 個測試通過、976 有效列、照抄檢查 0、建置 760 頁含型別檢查。`figures-command.json` 與 `supplement-command.json` 實際退出碼均為 0；各自的結果與範圍仍須讀原始收據。
- D 的 `smoke-command.json` 退出碼為 1：工具要求搜尋 `data-leakage` 排第一，但真 UI 顯示第二；`docs/specs/site-v1.md` 成功條件 9 允許前三。`FX-search-ui-contract` 正在另一工作樹處理，接手查其實際狀態，不預寫修完或合併。S1 的「召回率」公式搜尋見證通過，不代表一般中文「精確率」搜尋漏失已修復。
- 預覽 `http://127.0.0.1:4321/` 已更新為 D 的真實 build，`served-check.json` 記錄 23 個入口 HTTP 200 且 bytes 一致。常駐終端 `term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f` 勿關；版本變更後重新核對 served bytes，不沿用 D 的收據作為新版本證據。

## 三項待使用者決定

1. C12 原條件仍有 8 頁缺口，核可例外 0；固定八頁條件例外只是一項提案，見 `tmp/advisor/c12-approval-proposal.md`。分列原始缺口、已核可且本版有效例外及剩餘缺口，不造關係或清零。
2. 分析 CSV 欄位與 export 契約待核可，見 `tmp/advisor/export-approval-proposal.md`。不自行變更格式或手改衍生 CSV。
3. 自然中文輸入「精確率」的分詞漏失，是修復後才算完成或本輪接受所揭露限制，仍待決定；見 `tmp/advisor/figure-search-approval-proposal.md`。正式 60 次 UI 查詢仍須驗收，不能以診斷或 S1 見證代替。

## 接手與剩餘工作

1. 正式驗收仍在進行，保持產品來源凍結；先查實際 worker、dispatch 與收據，避免重派或覆寫。修正合併後須重新固定受測產品 SHA、build 和證據，文件 PR 的 SHA 不可冒充先前受測產品 SHA。
2. 按固定版本完成正式 R0–R10，包含完整 map、21 份 sheets、master 與人工視覺簽核；核對同版來源、receipt、圖片與人工證據。舊候選、離線 fixture 或局部通過不能代簽最終驗收。真舊正整數題目 revision 樣本尚未適用時照實標示，不以新版本冒充。
3. Run 為 `run_0668a2365727`，目前協調者 `term_5dfd834e-12b7-4ecf-8fd6-22838bb9a21f`、consumer generation 7。真正換協調者 session 才 `run-use` 並核實新 handle／generation；context 壓縮不重綁。依 `docs/orca-multi-agent.md` 驗收、release、關閉完成的 worker 終端並 ack，勿關常駐 preview。
4. 使用者偏好簡短清楚的繁體中文。中等難度明確任務可用 Terra／xhigh，協調與深度審查用 Sol／xhigh；本輪 Claude 停用，非作者不同 Codex session 審查應如實標明同 provider，不冒稱跨 provider。
5. 新工作樹先跑 `pnpm --dir demo install --frozen-lockfile`；Python 使用 `UV_PROJECT_ENVIRONMENT=D:/ipas-study/tools/python/.venv`、`UV_NO_SYNC=1`，PDF runtime 為 `D:/ipas-study/tmp/pdf_runtime`，來源資料讀各工作樹。協調者自行核對 diff、檢查、測試、build、正確 head 和非空成功 CI 後合併。

正式 `site/`、指引章末 70 題、額外模擬題及外部部署不在本輪範圍。不可修改原始 PDF／`text/`、放寬公式來源門檻或自行套用待核可方案。
