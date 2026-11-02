# 全站教材交接

2026-11-03 驗收快照，正式根目錄為 `D:/ipas-study`。狀態會繼續變動：接手先讀根目錄 `tmp/scratch/continuation-20261103-current.md`、`tmp/scratch/coordinator-current-state.json`，再用 Git、Orca CLI 與各階段收據核實；暫存快照也可能落後。已核可工作持續，不因 context 壓縮停止或重問。

## 已整合與版本界線

- 85／85 寫作組、485 個概念、200 題考古題及 1 題既有模擬題已整合；920／920 學習目標有涵蓋，976 個有效映射列為 947 complete、29 partial；21／21 學習路線及 21／21 速查已整合。這些數字不等於全站驗收完成。
- 148 頁 owner-first 只修 metadata，360 個責任列採非作者證據與既有簽章沿用鏈，保留原 reviewer 和 note，並非重新語意審查。公式 pending 及直接來源門檻不變，partial 不自行升級。
- 文件 PR 前的產品 main 為 `49b9582e002027b084e2ed4af2cfeb2fb93c90cc`。PR #80 favicon、#81 真 UI 搜尋前三名與冷啟完成守衛、#82 S1 深色連結及右端證據、#83 速查列印欄寬、#84 概念正文與公式配色均已合併；文件 PR 本身另有 SHA。#81 已處理 D 的搜尋驗收問題；一般中文「精確率」分詞仍是下述待決事項。
- 常駐預覽 `http://127.0.0.1:4321/` 仍提供歷史候選 E 的 dist，產品 SHA 為 `3d47c48e5b7c6c1f67ce4c271fd067a1a8afb69d`，不是目前 main。常駐終端 `term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f` 勿關；新版本須另核對 source、receipt 和 served bytes。

## 歷史 E 與後續修正

E 的 smoke、figures、map、sheets、supplement 五個正式階段 command 均退出 0；人工審查發現 S1 深色連結對比不足，因此 master 未啟動，整條 pipeline 保留退出 1 與原始證據。人工 smoke／figures 為 16 張通過、2 張有問題、3 張部分未能判斷；列印人工為 8 張無保留通過、13 張有問題；ROC 右端補圖兩張淺色通過、兩張深色有問題。S1 與列印修正已分別合入 #82、#83，歷史 E 不因此改寫為全綠。

概念深色配色舊版 `c04d58e19d4a5428ed8328ec138de8398a7949cb` 非作者審查高 0、中 1、低 1，不接受整合；中項為可見 AUC 公式淡字淺底。後續固定 `d5e70effa5db7703a618c668d41b6a889de0582d` 的新非作者離線複審高 0、中 0、低 0，範圍只及該修正，不代替正式 HTTP 或全站驗收。Root 已對 d5e 獨立取得 373 tests、976 有效映射、照抄 0、760 頁建置與前後來源一致；PR #84 在非空成功 CI 41539918990 後按固定 head 合併。這些不代替新 main 的正式瀏覽器驗收。新候選 F 尚未凍結，E 原收據、raw 與圖片不得重綁成 F。

## 待使用者決定

1. C12 原條件 8 頁缺口，已核可例外 0；固定八頁例外只是提案，原始缺口、有效核可例外及剩餘缺口須分列。
2. 分析 CSV 欄位及 export 契約待核可，不自行變更格式或手改衍生 CSV。
3. 一般中文「精確率」分詞漏失：修復或接受已揭露限制仍待決定；S1 的「召回率」見證不能代替此決策。

使用者試讀與試操作尚未執行，不能代簽。正式 R0–R10 與人工圖須綁定另行固定的新版本驗收；如沿用舊圖或既有簽章，須核對版本與內容並明記證據鏈，不能改原紀錄或冒稱已看新圖。真舊正整數題目 revision 樣本不適用時照實標示。

## 接手與環境

Run `run_0668a2365727`、協調者 `term_5dfd834e-12b7-4ecf-8fd6-22838bb9a21f`、consumer generation 7。真正換協調者 session 才依 [Orca 多代理流程](orca-multi-agent.md) `run-use` 並核實新 handle／generation；context 壓縮不重綁。先查實際 worker、dispatch、Git 和收據，避免重派或覆寫；依流程驗收、release、關閉完成的 worker 終端及 ack。

協調與深度審查用 Codex／Sol xhigh，中等難度明確任務可用 Terra xhigh；本輪 Claude 停用。非作者不同 Codex session 應如實標示同 provider。新工作樹先執行 `pnpm --dir demo install --frozen-lockfile`；Python 固定 `UV_PROJECT_ENVIRONMENT=D:/ipas-study/tools/python/.venv`、`UV_NO_SYNC=1`，PDF runtime 為 `D:/ipas-study/tmp/pdf_runtime`，來源資料讀各工作樹。

正式 `site/`、指引章末 70 題、新增模擬題及外部部署不在本輪範圍。原始 PDF／`text/` 不修改，不放寬公式來源門檻或自行套用待核可方案。
